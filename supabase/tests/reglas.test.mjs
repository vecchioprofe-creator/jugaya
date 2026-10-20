import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';

const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
// todas las migraciones, en orden
const dir = new URL('../migrations/', import.meta.url);
const sql = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => fs.readFileSync(new URL(f, dir), 'utf8')).join('\n');

await db.exec(`
  create schema auth;
  create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  -- imitación mínima de Supabase Storage
  create role authenticated;
  create role anon;
  create schema storage;
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(bucket_id text, name text);
  alter table storage.objects enable row level security;
`);
await db.exec(sql);
console.log('✔ migración aplicada');

const U = { root: '00000000-0000-0000-0000-000000000001', owner: '00000000-0000-0000-0000-000000000002',
            p1: '00000000-0000-0000-0000-000000000003', p2: '00000000-0000-0000-0000-000000000004' };
for (const [k, id] of Object.entries(U))
  await db.query(`insert into auth.users values ($1, $2, '{"full_name":"${k}"}')`, [id, k + '@gmail.com']);
const as = (uid) => db.exec(`select set_config('test.uid', '${uid}', false)`);
const one = async (q, p) => (await db.query(q, p)).rows[0];
let fails = 0;
const check = (name, cond, extra = '') => { console.log((cond ? '✔ ' : '✘ ') + name + (extra ? '  → ' + extra : '')); if (!cond) fails++; };
const expectError = async (name, fn, msg) => {
  try { await fn(); check(name, false, 'no dio error'); }
  catch (e) { check(name, e.message.includes(msg), e.message); }
};

check('perfil creado al registrarse', (await one(`select count(*)::int n from profiles`)).n === 4);

const club = await one(`insert into clubs (slug, nombre, estado, acepta_mercado_pago) values ('potrero','El Potrero','ACTIVO',true) returning id`);
await db.query(`insert into club_members values ($1,$2,'owner@gmail.com','DUENIO')`, [club.id, U.owner]);
const court = await one(`insert into courts (club_id, nombre, deporte) values ($1,'Cancha 1','FUTBOL') returning id`, [club.id]);
for (let d = 0; d < 7; d++)
  await db.query(`insert into court_schedules (court_id, dia_semana, hora_desde, hora_hasta, duracion_min, precio) values ($1,$2,'17:00','24:00',60,60000)`, [court.id, d]);

// turno a las H hs dentro de N días (hora Argentina)
const slot = (dias, hora) => `((date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') + interval '${dias} days' + interval '${hora} hours') at time zone 'America/Argentina/Buenos_Aires')`;
const reservar = (dias, hora, desafio = false, jug = ['Mateo','Rami','Turco','Fede','Chino']) =>
  one(`select * from crear_reserva($1, ${slot(dias, hora)}, $2, $3, $4)`, [court.id, desafio, jug, desafio ? 'Los Pibes' : null]);

await as(U.p1);
// 1. Normal con 10 días: vence a las 72 h
const b1 = await reservar(10, 21);
const h1 = await one(`select round(extract(epoch from vence_at - created_at)/3600) h, tipo, estado, sena_minima::int s from bookings where id=$1`, [b1.id]);
check('Normal (10 días): vence a las 72 h', h1.h == 72 && h1.tipo === 'NORMAL' && h1.estado === 'EN_PROCESO', JSON.stringify(h1));
check('Seña 50% = 30.000', h1.s === 30000);

// 2. Mismo turno de nuevo
await as(U.p2);
await expectError('Turno superpuesto bloqueado', () => reservar(10, 21), 'se acaba de ocupar');

// 3. Normal con 4 días: vence 3 días antes del partido
await as(U.p1);
const b3 = await reservar(4, 20);
const h3 = await one(`select round(extract(epoch from inicio - vence_at)/3600) h from bookings where id=$1`, [b3.id]);
check('Normal (4 días): vence 72 h antes del partido', h3.h == 72, JSON.stringify(h3));

// 4. Último momento con 2 días
const b4 = await reservar(2, 20);
const h4 = await one(`select tipo, precio_final::int p, sena_minima::int s, round(extract(epoch from vence_at - created_at)/3600) h from bookings where id=$1`, [b4.id]);
check('Último momento: -20% y seña sobre precio con descuento, 24 h', h4.tipo === 'ULTIMO_MOMENTO' && h4.p === 48000 && h4.s === 24000 && h4.h == 24, JSON.stringify(h4));

// 5. Desafío con 1 día → no permitido
await expectError('Desafío con menos de 3 días rechazado', () => reservar(1, 22, true), 'anticipación');

// 6. Desafío con 10 días
const b6 = await reservar(10, 22, true);
const h6 = await one(`select b.estado, round(extract(epoch from inicio - vence_at)/3600) h, t.sena_minima::int s,
                        (select count(*)::int from requests r where r.booking_id=b.id and r.tipo='RIVAL' and r.estado='ABIERTA') req
                      from bookings b join teams t on t.booking_id=b.id where b.id=$1`, [b6.id]);
check('Desafío: busca rival, vence 3 días antes, $15.000 por equipo, solicitud publicada', h6.estado === 'BUSCA_RIVAL' && h6.h == 72 && h6.s === 15000 && h6.req === 1, JSON.stringify(h6));

// 7. Aceptar desafío
await expectError('No puede desafiarse a sí mismo', async () => {
  const r = await one(`select id from requests where booking_id=$1`, [b6.id]);
  await db.query(`select aceptar_desafio($1,'X','1',$2)`, [r.id, ['a']]);
}, 'propio equipo');
await as(U.p2);
const req6 = await one(`select id from requests where booking_id=$1`, [b6.id]);
const teamB = (await one(`select aceptar_desafio($1,'Real Madrigal','+54911',$2) id`, [req6.id, ['Seba','Pipa','Lucho','Gonza','Tincho']])).id;
check('Rival aceptó: EN_PROCESO', (await one(`select estado from bookings where id=$1`, [b6.id])).estado === 'EN_PROCESO');

// 8. Pagos del desafío
const teamA = (await one(`select id from teams where booking_id=$1 and lado='A'`, [b6.id])).id;
const pagar = async (booking, team, monto, medio = 'MERCADO_PAGO', player = null) =>
  (await one(`insert into payments (booking_id, team_id, team_player_id, monto, medio) values ($1,$2,$3,$4,$5) returning id`, [booking, team, player, monto, medio])).id;
const pa = await pagar(b6.id, teamA, 15000);
await db.query(`select aprobar_pago($1)`, [pa]);
check('Solo equipo A pagó: sigue EN_PROCESO', (await one(`select estado from bookings where id=$1`, [b6.id])).estado === 'EN_PROCESO');
const pb = await pagar(b6.id, teamB, 15000);
await db.query(`select aprobar_pago($1)`, [pb]);
check('Ambos cubrieron su mitad: CONFIRMADO', (await one(`select estado, vence_at from bookings where id=$1`, [b6.id])).estado === 'CONFIRMADO');
await db.query(`select aprobar_pago($1)`, [pb]);   // webhook repetido
check('Webhook repetido no duplica', (await one(`select sum(monto)::int t from payments where booking_id=$1 and estado='APROBADO'`, [b6.id])).t === 30000);

// 9. Redistribución al eliminar un jugador que pagó
await as(U.p1);
const tA1 = (await one(`select id from teams where booking_id=$1`, [b1.id])).id;
const mateo = (await one(`select id from team_players where team_id=$1 and nombre='Mateo'`, [tA1])).id;
await db.query(`select aprobar_pago($1)`, [await pagar(b1.id, tA1, 6000, 'MERCADO_PAGO', mateo)]);
await db.query(`select renombrar_jugador($1,'Mateo G.')`, [mateo]);
check('Renombrar mantiene el monto', (await one(`select monto_acreditado::int m from team_players where id=$1`, [mateo])).m === 6000);
await as(U.p2);
await expectError('Solo el admin edita la lista', () => db.query(`select eliminar_jugador($1)`, [mateo]), 'Solo el admin');
await as(U.p1);
await db.query(`select eliminar_jugador($1)`, [mateo]);
const rest = (await db.query(`select monto_acreditado::int m from team_players where team_id=$1 and activo`, [tA1])).rows.map(r => r.m);
check('Eliminar a quien pagó $6.000 → +$1.500 a cada uno de los 4', rest.length === 4 && rest.every(m => m === 1500), JSON.stringify(rest));

// 10. Vencimientos
const b10 = await reservar(12, 20, true);          // desafío sin rival, con pago del equipo A
const t10 = (await one(`select id from teams where booking_id=$1`, [b10.id])).id;
await db.query(`select aprobar_pago($1)`, [await pagar(b10.id, t10, 15000)]);
const pend = await pagar(b3.id, (await one(`select id from teams where booking_id=$1`, [b3.id])).id, 5000, 'TRANSFERENCIA');
await db.query(`update payments set estado='EN_REVISION' where id=$1`, [pend]);
await db.query(`update bookings set vence_at = now() - interval '1 minute' where id in ($1,$2,$3)`, [b10.id, b3.id, b4.id]);
await db.query(`update payments set created_at = now() - interval '2 minutes' where id=$1`, [pend]);
const n = (await one(`select vencer_reservas() n`)).n;
const est = async (id) => (await one(`select estado from bookings where id=$1`, [id])).estado;
check('Vencen el desafío sin rival y el último momento impago', n === 2 && await est(b10.id) === 'VENCIDO' && await est(b4.id) === 'VENCIDO', 'vencidas: ' + n);
check('Comprobante en revisión frena el vencimiento', await est(b3.id) === 'EN_PROCESO');
check('Desafío vencido genera devolución', (await one(`select count(*)::int c, sum(monto)::int m from refunds where booking_id=$1`, [b10.id])).m === 15000);
check('Normal vencido NO genera devolución (club retiene)', (await one(`select count(*)::int c from refunds where booking_id=$1`, [b4.id])).c === 0);
const b4again = await reservar(2, 20);
check('Turno vencido vuelve a estar libre', !!b4again.id);

// 11. Cancelación por el club
await expectError('Un jugador no puede cancelar', () => db.query(`select cancelar_por_club($1,'x')`, [b6.id]), 'Sin permiso');
await as(U.owner);
await db.query(`select cancelar_por_club($1,'Rotura del césped')`, [b6.id]);
const c11 = await one(`select (select estado from bookings where id=$1) e, (select sum(monto)::int from refunds where booking_id=$1) m`, [b6.id]);
check('Club cancela: CANCELADO_CLUB y devolución de $30.000', c11.e === 'CANCELADO_CLUB' && c11.m === 30000, JSON.stringify(c11));

// 12. Plazos configurables con validación
await expectError('U no puede ser mayor que C', () => db.query(`update clubs set plazo_um_horas = 100 where id=$1`, [club.id]), 'plazos_validos');

// 13. Root: alta de clubes, invitación del dueño por Gmail, suscripciones
await as(U.p1);
await expectError('Un jugador no puede crear clubes', () => db.query(`select crear_club('X','x@gmail.com','Básico',20000)`), 'Solo root');
await db.query(`update profiles set es_root = true where id = $1`, [U.root]);
await as(U.root);
const nuevo = await one(`select * from crear_club('Pádel Ñandú Sur', 'Nuevo.Duenio@Gmail.com', 'Pro', 30000, 'Calle 1', 'Lanús', '54911')`);
check('Club creado pendiente de activación con slug legible', nuevo.estado === 'PENDIENTE_ACTIVACION' && nuevo.slug === 'padel-nandu-sur', nuevo.slug);
const otro = await one(`select slug from crear_club('Pádel Ñandú Sur', 'otro@gmail.com', 'Pro', 30000)`);
check('Slug repetido recibe sufijo', otro.slug === 'padel-nandu-sur-2', otro.slug);
check('Suscripción del mes creada sin pagar', (await one(`select count(*)::int n from subscriptions where club_id=$1 and not pagado and monto=30000`, [nuevo.id])).n === 1);
check('Generar suscripciones del mes es idempotente', (await one(`select generar_suscripciones_mes() n`)).n >= 0 && (await one(`select count(*)::int n from subscriptions where club_id=$1`, [nuevo.id])).n === 1);
await expectError('Gmail inválido rechazado', () => db.query(`select crear_club('Y','no-es-mail','Básico',1)`), 'no es válido');
// el dueño entra DESPUÉS de que root creó el club → queda vinculado
const nuevoDuenio = '00000000-0000-0000-0000-000000000009';
await db.query(`insert into auth.users values ($1, 'nuevo.duenio@gmail.com', '{}')`, [nuevoDuenio]);
check('Dueño invitado queda vinculado al ingresar', (await one(`select user_id from club_members where club_id=$1`, [nuevo.id])).user_id === nuevoDuenio);
// el dueño ya existía ANTES (p2) → queda vinculado al crear el club
const c3 = await one(`select id from crear_club('Club de P2', 'P2@gmail.com', 'Básico', 20000)`);
check('Dueño existente queda vinculado al crear el club', (await one(`select user_id from club_members where club_id=$1`, [c3.id])).user_id === U.p2);

// 14. El dueño no puede tocar campos de root
await as(nuevoDuenio);
await expectError('Dueño no puede destacarse solo', () => db.query(`update clubs set destacado_hasta = '2030-01-01' where id=$1`, [nuevo.id]), 'administrador');
await db.query(`update clubs set descripcion = 'Nueva descripción' where id=$1`, [nuevo.id]);
check('Dueño sí puede editar sus datos', (await one(`select descripcion from clubs where id=$1`, [nuevo.id])).descripcion === 'Nueva descripción');
await expectError('No puede publicar sin canchas con horarios', () => db.query(`update clubs set estado = 'ACTIVO' where id=$1`, [nuevo.id]), 'cancha');

// 15. Horarios (guardar_horarios) y cobros
const canchaN = (await one(`insert into courts (club_id, nombre, deporte) values ($1,'Cancha 1','PADEL') returning id`, [nuevo.id])).id;
const franjas = [{ dias: [1, 2, 3, 4, 5], desde: '17:00', hasta: '24:00', duracion: 90, precio: 30000 },
                 { dias: [6, 0], desde: '09:00', hasta: '13:00', duracion: 60, precio: 25000 }];
check('Guardar horarios crea una fila por día', (await one(`select guardar_horarios($1, $2::jsonb) n`, [canchaN, JSON.stringify(franjas)])).n === 7);
check('Guardar de nuevo reemplaza (no duplica)', (await one(`select guardar_horarios($1, $2::jsonb) n`, [canchaN, JSON.stringify(franjas)])).n === 7
  && (await one(`select count(*)::int n from court_schedules where court_id=$1`, [canchaN])).n === 7);
await expectError('Franjas superpuestas rechazadas', () => db.query(`select guardar_horarios($1, $2::jsonb)`,
  [canchaN, JSON.stringify([{ dias: [1], desde: '17:00', hasta: '20:00', duracion: 60, precio: 1 }, { dias: [1], desde: '19:00', hasta: '22:00', duracion: 60, precio: 1 }])]), 'superpuestas');
check('Error deja los horarios anteriores intactos', (await one(`select count(*)::int n from court_schedules where court_id=$1`, [canchaN])).n === 7);
await as(U.p1);
await expectError('Otro usuario no puede tocar los horarios', () => db.query(`select guardar_horarios($1, '[]'::jsonb)`, [canchaN]), 'Sin permiso');
await as(nuevoDuenio);
await expectError('No puede publicar sin medio de cobro', () => db.query(`update clubs set estado = 'ACTIVO' where id=$1`, [nuevo.id]), 'medio de cobro');
await expectError('Mercado Pago sin cuenta conectada rechazado', () => db.query(`update clubs set acepta_mercado_pago = true where id=$1`, [nuevo.id]), 'conectar');
await expectError('Transferencia sin titular rechazada', () => db.query(`update clubs set acepta_transferencia = true, transferencia_alias = 'club.alias' where id=$1`, [nuevo.id]), 'titular');
await db.query(`update clubs set acepta_transferencia = true, transferencia_alias = 'club.alias', transferencia_titular = 'Club SRL' where id=$1`, [nuevo.id]);
await db.query(`update clubs set estado = 'ACTIVO' where id=$1`, [nuevo.id]);
check('Dueño publica cuando cumple los requisitos', (await one(`select estado from clubs where id=$1`, [nuevo.id])).estado === 'ACTIVO');
check('Fotos: el dueño puede subir a la carpeta de su club', (await one(`select carpeta_es_mi_club($1) ok`, [`${nuevo.id}/foto.jpg`])).ok === true);
check('Fotos: no puede subir a la carpeta de otro club', (await one(`select carpeta_es_mi_club($1) ok`, [`${c3.id}/foto.jpg`])).ok === false);
check('Fotos: carpeta que no es un club rechazada', (await one(`select carpeta_es_mi_club('cualquiera/foto.jpg') ok`)).ok === false);
await as(U.root);
check('Fotos: root puede subir a cualquier club', (await one(`select carpeta_es_mi_club($1) ok`, [`${c3.id}/foto.jpg`])).ok === true);
await as(U.root);
await db.query(`update clubs set estado = 'SUSPENDIDO' where id=$1`, [nuevo.id]);
await as(nuevoDuenio);
await expectError('Dueño suspendido no puede reactivarse', () => db.query(`update clubs set estado = 'ACTIVO' where id=$1`, [nuevo.id]), 'administrador');

// 16. Pagos por transferencia y revisión del club
const priv = await one(`select has_function_privilege('anon', 'aprobar_pago(uuid,uuid)', 'execute') a,
                               has_function_privilege('authenticated', 'vencer_reservas()', 'execute') b,
                               has_function_privilege('authenticated', 'recalcular_reserva(uuid)', 'execute') c`);
check('Funciones internas bloqueadas para la web', !priv.a && !priv.b && !priv.c, JSON.stringify(priv));
await as(U.root);
await db.query(`update clubs set acepta_transferencia = true, transferencia_alias = 'potrero.club', transferencia_titular = 'Potrero SA' where id=$1`, [club.id]);
await as(U.p1);
const b16 = await reservar(9, 18);
const j16 = (await db.query(`select tp.id from team_players tp join teams t on t.id = tp.team_id where t.booking_id=$1 order by tp.orden`, [b16.id])).rows;
await as(''); // invitado sin cuenta
await expectError('Transferencia sin comprobante de esta reserva rechazada', () => db.query(`select informar_transferencia($1, 6000, 'otra/foto.jpg')`, [j16[1].id]), 'comprobante');
await expectError('No se puede pagar más que el total', () => db.query(`select informar_transferencia($1, 70000, $2)`, [j16[1].id, `${b16.id}/x.jpg`]), 'supera');
const pago16 = (await one(`select informar_transferencia($1, 30000, $2) id`, [j16[1].id, `${b16.id}/comp.jpg`])).id;
check('Invitado informa transferencia: queda en revisión', (await one(`select estado from payments where id=$1`, [pago16])).estado === 'EN_REVISION');
check('Comprobantes: se pueden subir a una reserva activa', (await one(`select carpeta_es_reserva_activa($1) ok`, [`${b16.id}/comp.jpg`])).ok === true);
await as(U.p2);
await expectError('Otro usuario no puede aprobar pagos', () => db.query(`select revisar_pago($1, true)`, [pago16]), 'Sin permiso');
check('Un jugador no puede ver comprobantes', (await one(`select carpeta_es_reserva_de_mi_club($1) ok`, [`${b16.id}/comp.jpg`])).ok === false);
await as(U.owner);
check('El club sí ve los comprobantes', (await one(`select carpeta_es_reserva_de_mi_club($1) ok`, [`${b16.id}/comp.jpg`])).ok === true);
check('Club aprueba la seña: CONFIRMADO', (await one(`select revisar_pago($1, true) e`, [pago16])).e === 'CONFIRMADO');
check('El monto se acredita al jugador', (await one(`select monto_acreditado::int m from team_players where id=$1`, [j16[1].id])).m === 30000);
await expectError('Un pago no se revisa dos veces', () => db.query(`select revisar_pago($1, false)`, [pago16]), 'ya fue revisado');
await as('');
const pago16b = (await one(`select informar_transferencia($1, 5000, $2) id`, [j16[2].id, `${b16.id}/c2.jpg`])).id;
await as(U.owner);
await db.query(`select revisar_pago($1, false, 'No se ve el monto')`, [pago16b]);
const rech = await one(`select p.estado, p.motivo_rechazo, tp.monto_acreditado::int m from payments p join team_players tp on tp.id = p.team_player_id where p.id=$1`, [pago16b]);
check('Rechazo guarda el motivo y no acredita', rech.estado === 'RECHAZADO' && rech.motivo_rechazo === 'No se ve el monto' && rech.m === 0, JSON.stringify(rech));
check('Cobro en el club completa el total: SALDADO', (await one(`select registrar_cobro_club($1, 30000) e`, [b16.id])).e === 'SALDADO');
await expectError('Reserva saldada no admite más cobros', () => db.query(`select registrar_cobro_club($1, 1)`, [b16.id]), 'no está activa');
const res16 = await one(`select aprobado::int a, en_revision::int r from resumen_pagos($1)`, [b16.id]);
check('Resumen de pagos: aprobado y en revisión', res16.a === 60000 && res16.r === 0, JSON.stringify(res16));
const colPriv = await one(`select has_column_privilege('anon', 'teams', 'whatsapp', 'select') w, has_column_privilege('anon', 'teams', 'nombre', 'select') n`);
check('WhatsApp del admin no se lee directo de la tabla', colPriv.w === false && colPriv.n === true, JSON.stringify(colPriv));
const team16 = (await one(`select id from teams where booking_id=$1`, [b16.id])).id;
await db.query(`update teams set whatsapp = '5491100000000' where id=$1`, [team16]);
await as('');
check('Sin sesión no se ve el WhatsApp del admin', (await one(`select contacto_admin($1) w`, [team16])).w === null);
await as(U.p2);
check('Con sesión sí se ve el WhatsApp del admin', (await one(`select contacto_admin($1) w`, [team16])).w === '5491100000000');

console.log(fails ? `\n✘ ${fails} pruebas fallaron` : '\n✔ Todas las pruebas pasaron');
process.exit(fails ? 1 : 0);
