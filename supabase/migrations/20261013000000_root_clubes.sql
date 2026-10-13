-- =====================================================================
-- JugáYa · Migración 2: alta de clubes por root, invitación de dueños por Gmail,
-- suscripciones mensuales (FLUJOS.md F20–F21).
-- =====================================================================

alter table clubs add column if not exists barrio text;
alter table clubs add column if not exists plan text;
alter table clubs add column if not exists monto_mensual numeric(12,2);

-- ---------------------------------------------------------------------
-- Vincular invitaciones (club_members.email) con el usuario real,
-- sin importar si el dueño entra antes o después de que root cree el club.
-- ---------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, nombre, avatar_url)
  values (new.id, new.email,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url');
  update club_members set user_id = new.id
   where lower(email) = lower(new.email) and user_id is null;
  return new;
end $$;

create or replace function vincular_miembro() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(trim(new.email));
  if new.user_id is null then
    select id into new.user_id from profiles where lower(email) = new.email;
  end if;
  return new;
end $$;

drop trigger if exists club_members_vincular on club_members;
create trigger club_members_vincular
  before insert or update of email on club_members
  for each row execute function vincular_miembro();

-- ---------------------------------------------------------------------
-- Root crea un club (sede) con su dueño y la suscripción del mes en curso
-- ---------------------------------------------------------------------
create or replace function crear_club(
  p_nombre        text,
  p_email_duenio  text,
  p_plan          text,
  p_monto         numeric,
  p_direccion     text default null,
  p_barrio        text default null,
  p_whatsapp      text default null
) returns clubs
language plpgsql security definer set search_path = public as $$
declare
  c       clubs;
  v_slug  text;
  v_base  text;
  i       int := 1;
begin
  if not es_root() then raise exception 'Solo root puede crear clubes'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Falta el nombre del club'; end if;
  if p_email_duenio !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'El Gmail del dueño no es válido'; end if;

  -- slug legible y único: "Complejo El Potrero" → complejo-el-potrero(-2)
  v_base := trim(both '-' from regexp_replace(lower(translate(p_nombre,
              'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^a-z0-9]+', '-', 'g'));
  v_slug := v_base;
  while exists (select 1 from clubs where slug = v_slug) loop
    i := i + 1;
    v_slug := v_base || '-' || i;
  end loop;

  insert into clubs (slug, nombre, direccion, barrio, whatsapp, plan, monto_mensual)
  values (v_slug, trim(p_nombre), p_direccion, p_barrio, p_whatsapp, p_plan, p_monto)
  returning * into c;

  insert into club_members (club_id, email, rol) values (c.id, p_email_duenio, 'DUENIO');

  insert into subscriptions (club_id, periodo, plan, monto)
  values (c.id, date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date, p_plan, coalesce(p_monto, 0));

  return c;
end $$;

-- ---------------------------------------------------------------------
-- Campos que solo root puede tocar. El dueño edita su club (datos, fotos,
-- reglas, cobros) pero no se puede autoactivar si está suspendido, destacarse
-- sin pagar, cambiar su plan ni su calificación.
-- Única excepción: publicar su club (PENDIENTE_ACTIVACION → ACTIVO).
-- ---------------------------------------------------------------------
create or replace function proteger_campos_root() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if es_root() or auth.uid() is null then return new; end if;   -- root o procesos internos
  if new.destacado_hasta is distinct from old.destacado_hasta
     or new.plan is distinct from old.plan
     or new.monto_mensual is distinct from old.monto_mensual
     or new.rating_promedio is distinct from old.rating_promedio
     or new.rating_cantidad is distinct from old.rating_cantidad
     or new.slug is distinct from old.slug then
    raise exception 'Ese dato del club solo lo puede cambiar el administrador de JugáYa';
  end if;
  if new.estado is distinct from old.estado
     and not (old.estado = 'PENDIENTE_ACTIVACION' and new.estado = 'ACTIVO') then
    raise exception 'El estado del club solo lo puede cambiar el administrador de JugáYa';
  end if;
  return new;
end $$;

drop trigger if exists clubs_proteger_campos_root on clubs;
create trigger clubs_proteger_campos_root
  before update on clubs for each row execute function proteger_campos_root();

-- Crea las filas de suscripción del mes para todos los clubes no suspendidos (idempotente)
create or replace function generar_suscripciones_mes(p_periodo date default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_periodo date := coalesce(p_periodo, date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date);
  n int;
begin
  if not es_root() then raise exception 'Solo root'; end if;
  insert into subscriptions (club_id, periodo, plan, monto)
  select id, v_periodo, plan, coalesce(monto_mensual, 0) from clubs where estado <> 'SUSPENDIDO'
  on conflict (club_id, periodo) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
