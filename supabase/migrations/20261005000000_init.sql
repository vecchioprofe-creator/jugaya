-- =====================================================================
-- JugáYa · Esquema inicial (Fase 2 · MVP Reservas)
-- Reglas de negocio: ver PLAN.md §3 y FLUJOS.md.
-- Torneos (fase 5) se agregan en una migración posterior.
-- =====================================================================

-- En Supabase las extensiones viven en el esquema "extensions"
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;  -- evitar turnos superpuestos
create extension if not exists pgcrypto with schema extensions;    -- códigos de grupo aleatorios

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type rol_club            as enum ('DUENIO', 'EMPLEADO');
create type deporte             as enum ('FUTBOL', 'PADEL', 'TENIS', 'BASQUET', 'VOLEY', 'OTRO');
create type nivel               as enum ('AMATEUR', 'INTERMEDIO', 'PROFESIONAL');
create type estado_club         as enum ('PENDIENTE_ACTIVACION', 'ACTIVO', 'SUSPENDIDO');
create type tipo_reserva        as enum ('NORMAL', 'DESAFIO', 'ULTIMO_MOMENTO', 'MANUAL');
create type estado_reserva      as enum ('BUSCA_RIVAL', 'EN_PROCESO', 'CONFIRMADO', 'SALDADO',
                                         'VENCIDO', 'CANCELADO_CLUB', 'JUGADO');
create type lado_equipo         as enum ('A', 'B');
create type medio_pago          as enum ('MERCADO_PAGO', 'TRANSFERENCIA', 'EN_CLUB');
create type estado_pago         as enum ('INICIADO', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'DEVUELTO');
create type tipo_solicitud      as enum ('JUGADOR', 'RIVAL');
create type estado_solicitud    as enum ('ABIERTA', 'COMPLETA', 'CERRADA', 'VENCIDA');
create type estado_devolucion   as enum ('PENDIENTE', 'HECHA');

-- ---------------------------------------------------------------------
-- Usuarios (1 a 1 con auth.users de Supabase; login con Google)
-- ---------------------------------------------------------------------
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null unique,
  nombre          text,
  apodo           text,
  whatsapp        text,                       -- obligatorio al completar perfil (J1)
  avatar_url      text,
  fecha_nac       date,
  deportes        deporte[] not null default '{}',
  posicion        text,
  nivel           nivel,
  es_root         boolean not null default false,
  acepto_tyc_at   timestamptz,
  created_at      timestamptz not null default now()
);

-- Crea el perfil automáticamente cuando alguien entra por primera vez con Google
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, nombre, avatar_url)
  values (new.id, new.email,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- Clubes / sedes
-- ---------------------------------------------------------------------
create table club_brands (                    -- agrupa sedes de un mismo club (multi-sede)
  id     uuid primary key default gen_random_uuid(),
  nombre text not null
);

create table clubs (
  id                       uuid primary key default gen_random_uuid(),
  brand_id                 uuid references club_brands(id),
  slug                     text not null unique,
  nombre                   text not null,
  descripcion              text,
  direccion                text,
  lat                      double precision,
  lng                      double precision,
  whatsapp                 text,
  horario_atencion         text,
  servicios                text[] not null default '{}',
  portada_url              text,
  estado                   estado_club not null default 'PENDIENTE_ACTIVACION',
  destacado_hasta          date,
  rating_promedio          numeric(2,1) not null default 0,
  rating_cantidad          int not null default 0,

  -- Reglas configurables (PLAN.md §4.2)
  plazo_pago_horas         int not null default 72,   -- P
  corte_horas              int not null default 72,   -- C (3 días)
  plazo_um_horas           int not null default 24,   -- U (Último momento)
  sena_pct                 numeric(5,2) not null default 50,
  descuento_um_pct         numeric(5,2) not null default 20,
  revision_comprobante_horas int not null default 12,
  permite_desafios         boolean not null default true,

  -- Cobros
  acepta_mercado_pago      boolean not null default false,
  acepta_transferencia     boolean not null default false,
  transferencia_alias      text,
  transferencia_cbu        text,
  transferencia_titular    text,

  google_calendar_id       text,
  created_at               timestamptz not null default now(),

  constraint plazos_validos check (corte_horas > 0 and plazo_pago_horas > 0
                                   and plazo_um_horas > 0 and plazo_um_horas <= corte_horas),
  constraint porcentajes_validos check (sena_pct between 0 and 100 and descuento_um_pct between 0 and 100)
);

-- Secretos del club: SOLO accesibles desde el servidor (service role). Sin políticas RLS = nadie más los lee.
create table club_secrets (
  club_id                   uuid primary key references clubs(id) on delete cascade,
  mp_access_token           text,
  mp_refresh_token          text,
  mp_user_id                text,
  google_refresh_token      text,
  updated_at                timestamptz not null default now()
);

create table club_members (
  club_id    uuid not null references clubs(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  email      text not null,                -- invitación por Gmail antes de que exista el usuario
  rol        rol_club not null,
  created_at timestamptz not null default now(),
  primary key (club_id, email)
);

create table club_photos (
  id       uuid primary key default gen_random_uuid(),
  club_id  uuid not null references clubs(id) on delete cascade,
  url      text not null,
  orden    int not null default 0
);

create table courts (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  nombre      text not null,
  deporte     deporte not null,
  tipo        text,                 -- F5, F7, pádel blindex, polvo de ladrillo...
  techada     boolean not null default false,
  superficie  text,
  capacidad   int,                  -- jugadores sugeridos (F5 = 10)
  activa      boolean not null default true,
  orden       int not null default 0
);

-- Grilla semanal: qué turnos ofrece cada cancha y a qué precio
create table court_schedules (
  id            uuid primary key default gen_random_uuid(),
  court_id      uuid not null references courts(id) on delete cascade,
  dia_semana    smallint not null check (dia_semana between 0 and 6),  -- 0 = domingo
  hora_desde    time not null,
  hora_hasta    time not null,
  duracion_min  int not null default 60 check (duracion_min > 0),
  precio        numeric(12,2) not null check (precio >= 0)
);

-- Bloqueos manuales del club (mantenimiento, clases, eventos)
create table court_blocks (
  id        uuid primary key default gen_random_uuid(),
  court_id  uuid not null references courts(id) on delete cascade,
  inicio    timestamptz not null,
  fin       timestamptz not null,
  motivo    text,
  creado_por uuid references profiles(id),
  check (fin > inicio)
);

-- ---------------------------------------------------------------------
-- Reservas, equipos, jugadores, pagos
-- ---------------------------------------------------------------------
create table bookings (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references clubs(id),
  court_id         uuid not null references courts(id),
  inicio           timestamptz not null,
  fin              timestamptz not null,
  tipo             tipo_reserva not null,
  estado           estado_reserva not null,
  precio_lista     numeric(12,2) not null,
  descuento_pct    numeric(5,2) not null default 0,
  precio_final     numeric(12,2) not null,
  sena_minima      numeric(12,2) not null,
  vence_at         timestamptz,           -- null cuando ya está confirmada o es manual
  creador_id       uuid references profiles(id),
  codigo           text not null unique default upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8)),
  -- reserva manual (teléfono / mostrador)
  manual_nombre    text,
  manual_telefono  text,
  -- cancelación por el club
  cancelado_motivo text,
  cancelado_por    uuid references profiles(id),
  cancelado_at     timestamptz,
  google_event_id  text,
  created_at       timestamptz not null default now(),
  check (fin > inicio),

  -- Garantía de la base: nunca dos reservas activas superpuestas en la misma cancha.
  -- Si dos personas tocan el mismo turno a la vez, la segunda recibe un error.
  constraint sin_superposicion exclude using gist (
    court_id with =,
    tstzrange(inicio, fin) with &&
  ) where (estado in ('BUSCA_RIVAL', 'EN_PROCESO', 'CONFIRMADO', 'SALDADO', 'JUGADO'))
);
create index on bookings (club_id, inicio);
create index on bookings (estado, vence_at);

create table teams (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references bookings(id) on delete cascade,
  lado         lado_equipo not null,
  nombre       text,
  admin_id     uuid references profiles(id),
  whatsapp     text,
  sena_minima  numeric(12,2) not null,   -- desafío: la mitad de la seña de la reserva
  unique (booking_id, lado)
);

create table team_players (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references teams(id) on delete cascade,
  user_id           uuid references profiles(id),
  nombre            text not null,
  -- Monto "a cuenta" que muestra la lista. Lo mueve la redistribución al eliminar
  -- a alguien que pagó; el dinero real está en payments.
  monto_acreditado  numeric(12,2) not null default 0,
  activo            boolean not null default true,
  orden             int not null default 0,
  created_at        timestamptz not null default now()
);

create table payments (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references bookings(id),
  team_id           uuid not null references teams(id),
  team_player_id    uuid references team_players(id),   -- a quién se le acredita
  pagador_id        uuid references profiles(id),        -- null = invitado sin cuenta
  monto             numeric(12,2) not null check (monto > 0),
  medio             medio_pago not null,
  estado            estado_pago not null default 'INICIADO',
  mp_payment_id     text unique,                         -- idempotencia de webhooks
  mp_preference_id  text,
  comprobante_path  text,                                -- Storage (transferencias)
  motivo_rechazo    text,
  revisado_por      uuid references profiles(id),
  revisado_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index on payments (booking_id, estado);

create table refunds (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id),
  payment_id  uuid not null references payments(id),
  monto       numeric(12,2) not null,
  motivo      text not null,               -- 'DESAFIO_INCOMPLETO' | 'CANCELADO_CLUB' | 'PAGO_TARDIO'
  estado      estado_devolucion not null default 'PENDIENTE',
  hecho_por   uuid references profiles(id),
  hecho_at    timestamptz,
  created_at  timestamptz not null default now(),
  unique (payment_id)
);

-- ---------------------------------------------------------------------
-- Solicitudes, reseñas, alertas, notificaciones
-- ---------------------------------------------------------------------
create table requests (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  team_id     uuid not null references teams(id) on delete cascade,
  tipo        tipo_solicitud not null,
  cantidad    int not null default 1 check (cantidad > 0),
  puesto      text,
  nivel       nivel,
  edad_min    int,
  edad_max    int,
  comentario  text,
  estado      estado_solicitud not null default 'ABIERTA',
  created_at  timestamptz not null default now()
);
create index on requests (estado, tipo);

create table reviews (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references clubs(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  booking_id      uuid references bookings(id),
  estrellas       smallint not null check (estrellas between 1 and 5),
  comentario      text,
  respuesta_club  text,
  denunciada      boolean not null default false,
  oculta          boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (user_id, booking_id)
);

create table alerts (                       -- "Avisame si se libera" / Último momento cerca
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  booking_id  uuid references bookings(id) on delete cascade,
  deporte     deporte,
  lat         double precision,
  lng         double precision,
  radio_km    numeric(5,1),
  created_at  timestamptz not null default now()
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  cuerpo      text,
  link        text,
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on notifications (user_id, leida, created_at desc);

create table activity_log (
  id          bigint generated always as identity primary key,
  club_id     uuid references clubs(id) on delete cascade,
  user_id     uuid references profiles(id),
  accion      text not null,
  booking_id  uuid references bookings(id),
  detalle     jsonb,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Root: suscripciones y publicidades
-- ---------------------------------------------------------------------
create table subscriptions (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  periodo     date not null,                -- primer día del mes
  plan        text,
  monto       numeric(12,2) not null,
  pagado      boolean not null default false,
  fecha_pago  date,
  medio       text,
  nota        text,
  unique (club_id, periodo)
);

create table ads (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  texto       text,
  imagen_url  text not null,
  imagen_mobile_url text,
  boton_texto text,
  link        text,
  cliente     text,
  desde       date not null,
  hasta       date not null,
  orden       int not null default 0,
  activa      boolean not null default true
);

-- =====================================================================
-- Reglas de negocio
-- =====================================================================

-- ¿Qué tipo de reserva corresponde a un turno según cuánto falta? (PLAN §3.1.b)
create function tipo_permitido(p_club clubs, p_inicio timestamptz, p_ahora timestamptz default now())
returns tipo_reserva language sql immutable as $$
  select case
    when p_inicio - p_ahora > make_interval(hours => p_club.corte_horas) then 'NORMAL'::tipo_reserva
    else 'ULTIMO_MOMENTO'::tipo_reserva
  end
$$;

-- Fecha y hora de vencimiento de la seña
create function calcular_vencimiento(p_club clubs, p_tipo tipo_reserva, p_inicio timestamptz,
                                     p_ahora timestamptz default now())
returns timestamptz language sql immutable as $$
  select case p_tipo
    when 'DESAFIO'        then p_inicio - make_interval(hours => p_club.corte_horas)
    when 'NORMAL'         then least(p_ahora + make_interval(hours => p_club.plazo_pago_horas),
                                     p_inicio - make_interval(hours => p_club.corte_horas))
    when 'ULTIMO_MOMENTO' then least(p_ahora + make_interval(hours => p_club.plazo_um_horas), p_inicio)
    else null   -- MANUAL: la carga el club, ya confirmada
  end
$$;

create function es_root() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select es_root from profiles where id = auth.uid()), false)
$$;

create function es_miembro_club(p_club uuid, p_solo_duenio boolean default false) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from club_members
    where club_id = p_club and user_id = auth.uid()
      and (not p_solo_duenio or rol = 'DUENIO')
  )
$$;

-- Recalcula el estado de una reserva después de cada pago aprobado.
create function recalcular_reserva(p_booking uuid) returns estado_reserva
language plpgsql security definer set search_path = public as $$
declare
  b        bookings;
  total    numeric;
  ok_sena  boolean;
begin
  select * into b from bookings where id = p_booking for update;
  if b.estado not in ('EN_PROCESO', 'BUSCA_RIVAL', 'CONFIRMADO') then
    return b.estado;
  end if;

  select coalesce(sum(monto), 0) into total
    from payments where booking_id = p_booking and estado = 'APROBADO';

  if b.tipo = 'DESAFIO' then
    -- Los dos equipos tienen que haber cubierto su mitad
    select count(*) = 2 and bool_and(pagado >= t.sena_minima) into ok_sena
      from teams t
      left join lateral (select coalesce(sum(monto), 0) pagado from payments p
                          where p.team_id = t.id and p.estado = 'APROBADO') x on true
     where t.booking_id = p_booking;
  else
    ok_sena := total >= b.sena_minima;
  end if;

  if total >= b.precio_final and ok_sena then
    update bookings set estado = 'SALDADO', vence_at = null where id = p_booking;
    return 'SALDADO';
  elsif ok_sena then
    update bookings set estado = 'CONFIRMADO', vence_at = null where id = p_booking;
    return 'CONFIRMADO';
  end if;
  return b.estado;
end $$;

-- Crear una reserva (F4/F10). Valida tipo y plazos; la superposición la impide la base.
create function crear_reserva(
  p_court      uuid,
  p_inicio     timestamptz,
  p_desafio    boolean,
  p_jugadores  text[],                 -- apodos, el creador primero
  p_equipo     text default null,
  p_whatsapp   text default null
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  c        clubs;
  sch      court_schedules;
  v_tipo   tipo_reserva;
  v_desc   numeric := 0;
  v_precio numeric;
  v_sena   numeric;
  b        bookings;
  v_team   uuid;
  i        int;
begin
  if auth.uid() is null then raise exception 'Necesitás ingresar con Google para reservar'; end if;

  select cl.* into c from clubs cl join courts co on co.club_id = cl.id
   where co.id = p_court and co.activa and cl.estado = 'ACTIVO';
  if not found then raise exception 'Cancha no disponible'; end if;

  if p_inicio <= now() then raise exception 'Ese turno ya pasó'; end if;

  -- El turno tiene que existir en la grilla del club (hora local Argentina)
  select * into sch from court_schedules s
   where s.court_id = p_court
     and s.dia_semana = extract(dow from p_inicio at time zone 'America/Argentina/Buenos_Aires')
     and (p_inicio at time zone 'America/Argentina/Buenos_Aires')::time >= s.hora_desde
     and (p_inicio at time zone 'America/Argentina/Buenos_Aires')::time
         + make_interval(mins => s.duracion_min) <= s.hora_hasta
   limit 1;
  if not found then raise exception 'Ese horario no está en la grilla del club'; end if;

  if exists (select 1 from court_blocks k where k.court_id = p_court
              and tstzrange(k.inicio, k.fin) && tstzrange(p_inicio, p_inicio + make_interval(mins => sch.duracion_min))) then
    raise exception 'El club bloqueó ese horario';
  end if;

  v_tipo := tipo_permitido(c, p_inicio);
  if p_desafio then
    if v_tipo = 'ULTIMO_MOMENTO' then raise exception 'Los desafíos se crean con más de % horas de anticipación', c.corte_horas; end if;
    if not c.permite_desafios then raise exception 'Este club no permite desafíos'; end if;
    v_tipo := 'DESAFIO';
  end if;

  if v_tipo = 'ULTIMO_MOMENTO' then v_desc := c.descuento_um_pct; end if;
  v_precio := round(sch.precio * (1 - v_desc / 100), 2);
  v_sena   := round(v_precio * c.sena_pct / 100, 2);   -- seña sobre precio con descuento

  insert into bookings (club_id, court_id, inicio, fin, tipo, estado, precio_lista, descuento_pct,
                        precio_final, sena_minima, vence_at, creador_id)
  values (c.id, p_court, p_inicio, p_inicio + make_interval(mins => sch.duracion_min), v_tipo,
          case when v_tipo = 'DESAFIO' then 'BUSCA_RIVAL' else 'EN_PROCESO' end::estado_reserva,
          sch.precio, v_desc, v_precio, v_sena, calcular_vencimiento(c, v_tipo, p_inicio), auth.uid())
  returning * into b;

  insert into teams (booking_id, lado, nombre, admin_id, whatsapp, sena_minima)
  values (b.id, 'A', p_equipo, auth.uid(),
          coalesce(p_whatsapp, (select whatsapp from profiles where id = auth.uid())),
          case when p_desafio then round(v_sena / 2, 2) else v_sena end)
  returning id into v_team;

  for i in 1 .. coalesce(array_length(p_jugadores, 1), 0) loop
    insert into team_players (team_id, user_id, nombre, orden)
    values (v_team, case when i = 1 then auth.uid() end, p_jugadores[i], i);
  end loop;

  if p_desafio then
    insert into requests (booking_id, team_id, tipo, cantidad)
    values (b.id, v_team, 'RIVAL', greatest(coalesce(array_length(p_jugadores, 1), 1), 1));
  end if;

  return b;
exception when exclusion_violation then
  raise exception 'Ese turno se acaba de ocupar';
end $$;

-- Eliminar jugador (F7): si había pagado, su monto se reparte en partes iguales
create function eliminar_jugador(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  pl     team_players;
  t      teams;
  n      int;
begin
  select * into pl from team_players where id = p_player and activo for update;
  if not found then raise exception 'Jugador no encontrado'; end if;
  select * into t from teams where id = pl.team_id;
  if t.admin_id is distinct from auth.uid() then raise exception 'Solo el admin del equipo puede editar la lista'; end if;

  select count(*) into n from team_players where team_id = t.id and activo and id <> p_player;
  if n = 0 then raise exception 'El equipo no puede quedar vacío'; end if;

  update team_players set activo = false where id = p_player;
  if pl.monto_acreditado > 0 then
    update team_players set monto_acreditado = monto_acreditado + round(pl.monto_acreditado / n, 2)
     where team_id = t.id and activo;
    update team_players set monto_acreditado = 0 where id = p_player;
  end if;
end $$;

-- Renombrar (F7): el monto acreditado queda para la nueva persona
create function renombrar_jugador(p_player uuid, p_nombre text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update team_players tp set nombre = p_nombre
    from teams t
   where tp.id = p_player and t.id = tp.team_id and tp.activo and t.admin_id = auth.uid();
  if not found then raise exception 'Solo el admin del equipo puede editar la lista'; end if;
end $$;

-- Agregar jugador (F7) o sumarse desde una solicitud (F8)
create function agregar_jugador(p_team uuid, p_nombre text, p_request uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t      teams;
  r      requests;
  v_id   uuid;
  v_ord  int;
begin
  select * into t from teams where id = p_team;
  if not found then raise exception 'Equipo no encontrado'; end if;
  if p_request is null and t.admin_id is distinct from auth.uid() then
    raise exception 'Solo el admin del equipo puede agregar jugadores';
  end if;
  if p_request is not null then
    select * into r from requests where id = p_request and team_id = p_team and tipo = 'JUGADOR'
       and estado = 'ABIERTA' for update;
    if not found then raise exception 'La solicitud ya no está abierta'; end if;
  end if;

  select coalesce(max(orden), 0) + 1 into v_ord from team_players where team_id = p_team;
  insert into team_players (team_id, user_id, nombre, orden)
  values (p_team, case when p_request is not null then auth.uid() end, p_nombre, v_ord)
  returning id into v_id;

  if p_request is not null then
    update requests set cantidad = cantidad - 1,
                        estado = case when cantidad - 1 <= 0 then 'COMPLETA'::estado_solicitud else estado end
     where id = p_request;
  end if;
  return v_id;
end $$;

-- Aceptar un desafío (F9): crea la lista B enfrentada
create function aceptar_desafio(p_request uuid, p_equipo text, p_whatsapp text, p_jugadores text[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r      requests;
  b      bookings;
  v_team uuid;
  i      int;
begin
  if auth.uid() is null then raise exception 'Necesitás ingresar con Google'; end if;
  select * into r from requests where id = p_request and tipo = 'RIVAL' and estado = 'ABIERTA' for update;
  if not found then raise exception 'El desafío ya no está disponible'; end if;
  select * into b from bookings where id = r.booking_id for update;
  if b.estado <> 'BUSCA_RIVAL' or b.vence_at <= now() then raise exception 'El desafío ya no está disponible'; end if;
  if exists (select 1 from teams where booking_id = b.id and admin_id = auth.uid()) then
    raise exception 'No podés desafiar a tu propio equipo';
  end if;

  insert into teams (booking_id, lado, nombre, admin_id, whatsapp, sena_minima)
  values (b.id, 'B', p_equipo, auth.uid(), p_whatsapp, round(b.sena_minima / 2, 2))
  returning id into v_team;

  for i in 1 .. coalesce(array_length(p_jugadores, 1), 0) loop
    insert into team_players (team_id, user_id, nombre, orden)
    values (v_team, case when i = 1 then auth.uid() end, p_jugadores[i], i);
  end loop;

  update requests set estado = 'COMPLETA' where id = p_request;
  update bookings set estado = 'EN_PROCESO' where id = b.id;   -- el vencimiento sigue siendo partido − C
  perform recalcular_reserva(b.id);
  return v_team;
end $$;

-- Aprobar un pago (webhook de MP, aprobación de comprobante o cobro en el club)
create function aprobar_pago(p_payment uuid, p_revisor uuid default null) returns estado_reserva
language plpgsql security definer set search_path = public as $$
declare
  p payments;
begin
  update payments set estado = 'APROBADO', revisado_por = p_revisor, revisado_at = now()
   where id = p_payment and estado in ('INICIADO', 'EN_REVISION')
  returning * into p;
  if not found then  -- ya aprobado (webhook repetido) o rechazado: no se suma dos veces
    return (select b.estado from bookings b join payments x on x.booking_id = b.id where x.id = p_payment);
  end if;
  if p.team_player_id is not null then
    update team_players set monto_acreditado = monto_acreditado + p.monto where id = p.team_player_id;
  end if;
  return recalcular_reserva(p.booking_id);
end $$;

-- Vencimientos (correr cada minuto con pg_cron, ver supabase/cron.sql)
create function vencer_reservas() returns int
language plpgsql security definer set search_path = public as $$
declare
  b    record;
  n    int := 0;
begin
  for b in
    select * from bookings
     where estado in ('EN_PROCESO', 'BUSCA_RIVAL') and vence_at < now()
       -- un comprobante subido antes del vencimiento frena el vencimiento hasta que se revise
       and not exists (select 1 from payments p where p.booking_id = bookings.id
                        and p.estado = 'EN_REVISION' and p.created_at <= bookings.vence_at)
     for update skip locked
  loop
    update bookings set estado = 'VENCIDO' where id = b.id;
    update requests set estado = 'VENCIDA' where booking_id = b.id and estado = 'ABIERTA';
    if b.tipo = 'DESAFIO' then
      -- desafío incompleto: se devuelve todo lo pagado
      insert into refunds (booking_id, payment_id, monto, motivo)
      select b.id, p.id, p.monto, 'DESAFIO_INCOMPLETO'
        from payments p where p.booking_id = b.id and p.estado = 'APROBADO'
      on conflict (payment_id) do nothing;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Cancelación por el club (problema ajeno): devolver todo lo pagado
create function cancelar_por_club(p_booking uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if not es_miembro_club(b.club_id) then raise exception 'Sin permiso'; end if;
  if b.estado not in ('BUSCA_RIVAL', 'EN_PROCESO', 'CONFIRMADO', 'SALDADO') then
    raise exception 'La reserva no está activa';
  end if;
  update bookings set estado = 'CANCELADO_CLUB', cancelado_motivo = p_motivo,
                      cancelado_por = auth.uid(), cancelado_at = now(), vence_at = null
   where id = p_booking;
  update requests set estado = 'CERRADA' where booking_id = p_booking and estado = 'ABIERTA';
  insert into refunds (booking_id, payment_id, monto, motivo)
  select p_booking, p.id, p.monto, 'CANCELADO_CLUB'
    from payments p where p.booking_id = p_booking and p.estado = 'APROBADO'
  on conflict (payment_id) do nothing;
  insert into activity_log (club_id, user_id, accion, booking_id, detalle)
  values (b.club_id, auth.uid(), 'CANCELAR_TURNO', p_booking, jsonb_build_object('motivo', p_motivo));
end $$;

-- =====================================================================
-- Seguridad (Row Level Security)
-- Lecturas públicas donde el producto lo pide; escrituras sensibles solo vía funciones.
-- =====================================================================
alter table profiles        enable row level security;
alter table club_brands     enable row level security;
alter table clubs           enable row level security;
alter table club_secrets    enable row level security;   -- sin políticas: solo el servidor
alter table club_members    enable row level security;
alter table club_photos     enable row level security;
alter table courts          enable row level security;
alter table court_schedules enable row level security;
alter table court_blocks    enable row level security;
alter table bookings        enable row level security;
alter table teams           enable row level security;
alter table team_players    enable row level security;
alter table payments        enable row level security;
alter table refunds         enable row level security;
alter table requests        enable row level security;
alter table reviews         enable row level security;
alter table alerts          enable row level security;
alter table notifications   enable row level security;
alter table activity_log    enable row level security;
alter table subscriptions   enable row level security;
alter table ads             enable row level security;

-- Perfiles: cada uno edita el suyo; root ve todos
create policy perfil_propio_select on profiles for select using (id = auth.uid() or es_root());
create policy perfil_propio_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and es_root = es_root());   -- nadie se auto-asciende a root

-- Catálogo público
create policy clubs_publicos on clubs for select
  using (estado = 'ACTIVO' or es_miembro_club(id) or es_root());
create policy clubs_editar on clubs for update using (es_miembro_club(id, true) or es_root());
create policy clubs_root on clubs for insert with check (es_root());
create policy brands_publicas on club_brands for select using (true);
create policy brands_root on club_brands for all using (es_root());

create policy fotos_publicas on club_photos for select using (true);
create policy fotos_duenio on club_photos for all using (es_miembro_club(club_id, true) or es_root());
create policy canchas_publicas on courts for select using (true);
create policy canchas_duenio on courts for all using (es_miembro_club(club_id, true) or es_root());
create policy grilla_publica on court_schedules for select using (true);
create policy grilla_duenio on court_schedules for all
  using (es_miembro_club((select club_id from courts where id = court_id), true) or es_root());
create policy bloqueos_publicos on court_blocks for select using (true);
create policy bloqueos_club on court_blocks for all
  using (es_miembro_club((select club_id from courts where id = court_id)) or es_root());

create policy miembros_ver on club_members for select
  using (user_id = auth.uid() or es_miembro_club(club_id) or es_root());
create policy miembros_duenio on club_members for all using (es_miembro_club(club_id, true) or es_root());

-- Reservas y listas: públicas (el link del grupo se comparte); se modifican vía funciones
create policy reservas_publicas on bookings for select using (true);
create policy equipos_publicos on teams for select using (true);
create policy jugadores_publicos on team_players for select using (true);
create policy solicitudes_publicas on requests for select using (true);

-- Pagos: los ve el club, el que pagó y los admins del grupo
create policy pagos_ver on payments for select using (
  pagador_id = auth.uid() or es_miembro_club((select club_id from bookings where id = booking_id))
  or exists (select 1 from teams t where t.booking_id = payments.booking_id and t.admin_id = auth.uid())
  or es_root());
create policy devoluciones_club on refunds for select
  using (es_miembro_club((select club_id from bookings where id = booking_id)) or es_root());

-- Reseñas
create policy resenas_publicas on reviews for select using (not oculta or es_root());
create policy resenas_crear on reviews for insert with check (
  user_id = auth.uid() and exists (
    select 1 from bookings b join teams t on t.booking_id = b.id join team_players tp on tp.team_id = t.id
     where b.id = booking_id and b.club_id = reviews.club_id and b.estado = 'JUGADO' and tp.user_id = auth.uid()));
create policy resenas_responder on reviews for update using (es_miembro_club(club_id, true) or es_root());

-- Personales
create policy alertas_propias on alerts for all using (user_id = auth.uid());
create policy notif_propias on notifications for select using (user_id = auth.uid());
create policy notif_leer on notifications for update using (user_id = auth.uid());

-- Actividad: solo el dueño
create policy actividad_duenio on activity_log for select using (es_miembro_club(club_id, true) or es_root());

-- Root
create policy suscripciones_root on subscriptions for all using (es_root());
create policy suscripciones_duenio on subscriptions for select using (es_miembro_club(club_id, true));
create policy ads_publicas on ads for select using (activa and current_date between desde and hasta or es_root());
create policy ads_root on ads for all using (es_root());
