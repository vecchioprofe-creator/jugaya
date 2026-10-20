-- =====================================================================
-- JugáYa · Migración 3: panel del dueño (FLUJOS.md F13 y F16)
-- Fotos en Storage, guardado atómico de horarios, requisitos para publicar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fotos: bucket público (cualquiera las ve); solo el dueño sube o borra
-- dentro de la carpeta de su club: club-fotos/<club_id>/<archivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-fotos', 'club-fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function carpeta_es_mi_club(p_nombre text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_club uuid;
begin
  begin
    v_club := (string_to_array(p_nombre, '/'))[1]::uuid;
  exception when others then
    return false;   -- la carpeta no es un id de club
  end;
  return es_miembro_club(v_club, true) or es_root();   -- root puede ayudar a configurar
end $$;

drop policy if exists "club-fotos: el dueño sube" on storage.objects;
create policy "club-fotos: el dueño sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'club-fotos' and public.carpeta_es_mi_club(name));

drop policy if exists "club-fotos: el dueño borra" on storage.objects;
create policy "club-fotos: el dueño borra" on storage.objects for delete to authenticated
  using (bucket_id = 'club-fotos' and public.carpeta_es_mi_club(name));

-- ---------------------------------------------------------------------
-- Horarios de una cancha: se reemplazan completos en una sola operación.
-- p_franjas: [{"dias":[1,2,3],"desde":"17:00","hasta":"24:00","duracion":60,"precio":60000}, ...]
-- ---------------------------------------------------------------------
create or replace function guardar_horarios(p_court uuid, p_franjas jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_club  uuid;
  f       jsonb;
  d       jsonb;
  v_desde time;
  v_hasta time;
  v_dur   int;
  v_prec  numeric;
  n       int := 0;
begin
  select club_id into v_club from courts where id = p_court;
  if v_club is null then raise exception 'Cancha no encontrada'; end if;
  if not (es_miembro_club(v_club, true) or es_root()) then raise exception 'Sin permiso'; end if;
  if jsonb_typeof(p_franjas) <> 'array' then raise exception 'Formato de horarios inválido'; end if;

  delete from court_schedules where court_id = p_court;

  for f in select * from jsonb_array_elements(p_franjas) loop
    v_desde := (f->>'desde')::time;
    v_hasta := (f->>'hasta')::time;
    v_dur   := (f->>'duracion')::int;
    v_prec  := (f->>'precio')::numeric;
    if v_hasta <= v_desde and v_hasta <> '24:00'::time then
      raise exception 'En una franja, "hasta" (%) tiene que ser después de "desde" (%)', v_hasta, v_desde;
    end if;
    if v_dur is null or v_dur < 30 then raise exception 'La duración del turno tiene que ser de al menos 30 minutos'; end if;
    if v_prec is null or v_prec < 0 then raise exception 'El precio no puede ser negativo'; end if;
    if jsonb_array_length(coalesce(f->'dias', '[]')) = 0 then raise exception 'Cada franja tiene que tener al menos un día'; end if;

    for d in select * from jsonb_array_elements(f->'dias') loop
      -- sin franjas superpuestas el mismo día
      if exists (select 1 from court_schedules s
                  where s.court_id = p_court and s.dia_semana = d::text::smallint
                    and s.hora_desde < v_hasta and v_desde < s.hora_hasta) then
        raise exception 'Hay franjas superpuestas el mismo día';
      end if;
      insert into court_schedules (court_id, dia_semana, hora_desde, hora_hasta, duracion_min, precio)
      values (p_court, d::text::smallint, v_desde, v_hasta, v_dur, v_prec);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Campos reservados a root + requisitos para que el dueño publique
-- (reemplaza la versión de la migración 2)
-- ---------------------------------------------------------------------
create or replace function proteger_campos_root() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Cobros: Mercado Pago solo con la cuenta conectada; transferencia con sus datos
  if new.acepta_mercado_pago and not old.acepta_mercado_pago
     and not exists (select 1 from club_secrets where club_id = new.id and mp_access_token is not null) then
    raise exception 'Para cobrar con Mercado Pago primero hay que conectar la cuenta';
  end if;
  if new.acepta_transferencia
     and (coalesce(trim(new.transferencia_titular), '') = ''
          or coalesce(trim(new.transferencia_alias), '') = '' and coalesce(trim(new.transferencia_cbu), '') = '') then
    raise exception 'Para cobrar por transferencia completá el titular y el alias o CBU';
  end if;

  if es_root() or auth.uid() is null then return new; end if;   -- root o procesos internos

  if new.destacado_hasta is distinct from old.destacado_hasta
     or new.plan is distinct from old.plan
     or new.monto_mensual is distinct from old.monto_mensual
     or new.rating_promedio is distinct from old.rating_promedio
     or new.rating_cantidad is distinct from old.rating_cantidad
     or new.slug is distinct from old.slug then
    raise exception 'Ese dato del club solo lo puede cambiar el administrador de JugáYa';
  end if;

  if new.estado is distinct from old.estado then
    if not (old.estado = 'PENDIENTE_ACTIVACION' and new.estado = 'ACTIVO') then
      raise exception 'El estado del club solo lo puede cambiar el administrador de JugáYa';
    end if;
    -- requisitos para publicar
    if not exists (select 1 from courts c join court_schedules s on s.court_id = c.id
                    where c.club_id = new.id and c.activa) then
      raise exception 'Antes de publicar cargá al menos una cancha con sus horarios';
    end if;
    if not (new.acepta_mercado_pago or new.acepta_transferencia) then
      raise exception 'Antes de publicar configurá al menos un medio de cobro';
    end if;
  end if;
  return new;
end $$;
