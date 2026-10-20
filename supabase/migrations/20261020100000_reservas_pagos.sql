-- =====================================================================
-- JugáYa · Migración 4: reserva del jugador y pagos por transferencia
-- (FLUJOS.md F4–F7, F14). Mercado Pago llega en una migración posterior.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Seguridad: funciones internas que NO se pueden llamar desde la web.
--    (aprobar un pago o recalcular estados solo lo hacen otras funciones
--    que antes verifican permisos, el cron o el servidor).
-- ---------------------------------------------------------------------
revoke execute on function aprobar_pago(uuid, uuid) from public, anon, authenticated;
revoke execute on function recalcular_reserva(uuid) from public, anon, authenticated;
revoke execute on function vencer_reservas() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1b. Privacidad: el WhatsApp del admin de un grupo no se lee directo de la
--     tabla (la página del grupo es pública). Se pide con contacto_admin().
-- ---------------------------------------------------------------------
revoke select on teams from anon, authenticated;
grant select (id, booking_id, lado, nombre, admin_id, sena_minima) on teams to anon, authenticated;

create or replace function contacto_admin(p_team uuid) returns text
language sql stable security definer set search_path = public as $$
  -- solo para usuarios con sesión iniciada (queda registro de quién es)
  select whatsapp from teams where id = p_team and auth.uid() is not null
$$;

-- Totales de pagos de una reserva (públicos; el detalle de cada pago no)
create or replace function resumen_pagos(p_booking uuid)
returns table (aprobado numeric, en_revision numeric)
language sql stable security definer set search_path = public as $$
  select coalesce(sum(monto) filter (where estado = 'APROBADO'), 0),
         coalesce(sum(monto) filter (where estado = 'EN_REVISION'), 0)
    from payments where booking_id = p_booking
$$;

-- ---------------------------------------------------------------------
-- 2. Comprobantes: bucket PRIVADO. Cualquiera (incluso un invitado sin
--    cuenta) puede subir a la carpeta de una reserva activa; solo el club
--    (y root) los puede ver. Ruta: comprobantes/<booking_id>/<archivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create or replace function reserva_de_carpeta(p_nombre text) returns uuid
language plpgsql immutable as $$
begin
  return (string_to_array(p_nombre, '/'))[1]::uuid;
exception when others then
  return null;
end $$;

create or replace function carpeta_es_reserva_activa(p_nombre text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from bookings
                  where id = reserva_de_carpeta(p_nombre)
                    and estado in ('BUSCA_RIVAL', 'EN_PROCESO', 'CONFIRMADO'))
$$;

create or replace function carpeta_es_reserva_de_mi_club(p_nombre text) returns boolean
language sql stable security definer set search_path = public as $$
  select es_root() or exists (select 1 from bookings
                               where id = reserva_de_carpeta(p_nombre) and es_miembro_club(club_id))
$$;

drop policy if exists "comprobantes: se suben a una reserva activa" on storage.objects;
create policy "comprobantes: se suben a una reserva activa" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'comprobantes' and public.carpeta_es_reserva_activa(name));

drop policy if exists "comprobantes: los ve el club" on storage.objects;
create policy "comprobantes: los ve el club" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and public.carpeta_es_reserva_de_mi_club(name));

-- ---------------------------------------------------------------------
-- 3. El jugador (o un invitado) informa una transferencia con comprobante
-- ---------------------------------------------------------------------
create or replace function informar_transferencia(p_player uuid, p_monto numeric, p_comprobante text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  tp     team_players;
  t      teams;
  b      bookings;
  c      clubs;
  v_comp numeric;
  v_id   uuid;
begin
  select * into tp from team_players where id = p_player and activo;
  if not found then raise exception 'Jugador no encontrado en la lista'; end if;
  select * into t from teams where id = tp.team_id;
  select * into b from bookings where id = t.booking_id for update;
  if b.estado not in ('BUSCA_RIVAL', 'EN_PROCESO', 'CONFIRMADO') then
    raise exception 'Esta reserva ya no recibe pagos';
  end if;
  if b.vence_at is not null and now() > b.vence_at then
    raise exception 'El plazo para pagar la seña ya venció';
  end if;
  select * into c from clubs where id = b.club_id;
  if not c.acepta_transferencia then raise exception 'Este club no recibe transferencias'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto tiene que ser mayor a cero'; end if;
  if coalesce(p_comprobante, '') not like b.id::text || '/%' then raise exception 'Falta el comprobante'; end if;

  -- no se puede pagar más que el total (contando lo que está en revisión)
  select coalesce(sum(monto), 0) into v_comp
    from payments where booking_id = b.id and estado in ('APROBADO', 'EN_REVISION');
  if v_comp + p_monto > b.precio_final then
    raise exception 'El monto supera lo que falta pagar ($%)', b.precio_final - v_comp;
  end if;

  insert into payments (booking_id, team_id, team_player_id, pagador_id, monto, medio, estado, comprobante_path)
  values (b.id, t.id, tp.id, auth.uid(), p_monto, 'TRANSFERENCIA', 'EN_REVISION', p_comprobante)
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 4. El club (dueño o empleado) aprueba o rechaza un comprobante
-- ---------------------------------------------------------------------
create or replace function revisar_pago(p_payment uuid, p_aprobar boolean, p_motivo text default null)
returns estado_reserva
language plpgsql security definer set search_path = public as $$
declare
  p  payments;
  b  bookings;
begin
  select * into p from payments where id = p_payment for update;
  if not found then raise exception 'Pago no encontrado'; end if;
  select * into b from bookings where id = p.booking_id;
  if not (es_miembro_club(b.club_id) or es_root()) then raise exception 'Sin permiso'; end if;
  if p.estado <> 'EN_REVISION' then raise exception 'Este pago ya fue revisado'; end if;

  insert into activity_log (club_id, user_id, accion, booking_id, detalle)
  values (b.club_id, auth.uid(), case when p_aprobar then 'APROBAR_PAGO' else 'RECHAZAR_PAGO' end, b.id,
          jsonb_build_object('pago', p.id, 'monto', p.monto, 'motivo', p_motivo));

  if p_aprobar then
    return aprobar_pago(p_payment, auth.uid());
  end if;
  update payments set estado = 'RECHAZADO', motivo_rechazo = coalesce(nullif(trim(p_motivo), ''), 'Comprobante no válido'),
                      revisado_por = auth.uid(), revisado_at = now()
   where id = p_payment;
  return b.estado;
end $$;

-- ---------------------------------------------------------------------
-- 5. El club registra un cobro en el lugar (efectivo / transferencia en mano)
-- ---------------------------------------------------------------------
create or replace function registrar_cobro_club(p_booking uuid, p_monto numeric) returns estado_reserva
language plpgsql security definer set search_path = public as $$
declare
  b      bookings;
  v_team uuid;
  v_comp numeric;
  v_id   uuid;
begin
  select * into b from bookings where id = p_booking for update;
  if not found then raise exception 'Reserva no encontrada'; end if;
  if not (es_miembro_club(b.club_id) or es_root()) then raise exception 'Sin permiso'; end if;
  if b.estado not in ('BUSCA_RIVAL', 'EN_PROCESO', 'CONFIRMADO') then raise exception 'La reserva no está activa'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto tiene que ser mayor a cero'; end if;
  select coalesce(sum(monto), 0) into v_comp from payments where booking_id = b.id and estado in ('APROBADO', 'EN_REVISION');
  if v_comp + p_monto > b.precio_final then
    raise exception 'El monto supera lo que falta cobrar ($%)', b.precio_final - v_comp;
  end if;
  select id into v_team from teams where booking_id = b.id and lado = 'A';

  insert into payments (booking_id, team_id, pagador_id, monto, medio, estado)
  values (b.id, v_team, auth.uid(), p_monto, 'EN_CLUB', 'INICIADO') returning id into v_id;
  insert into activity_log (club_id, user_id, accion, booking_id, detalle)
  values (b.club_id, auth.uid(), 'COBRO_EN_CLUB', b.id, jsonb_build_object('monto', p_monto));
  return aprobar_pago(v_id, auth.uid());
end $$;
