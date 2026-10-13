# Plataforma de Reservas de Canchas — Plan Maestro (Etapa 1: Consulta y Planificación)

> Nombre provisorio: **JugáYa** (lo cambiamos cuando definas marca).
> Prototipo visual: [`prototipo/index.html`](prototipo/index.html) — abrilo en el navegador, es 100% visual (sin backend).

---

## 1. Visión en una línea

Un "Booking + Mercado Pago + grupo de WhatsApp" para el deporte amateur: encontrás cancha, armás el equipo, cada uno paga su parte desde un link y el club ve todo en su panel y en su Google Calendar.

---

## 2. Actores (roles)

| Rol | Cómo entra | Qué puede hacer |
|---|---|---|
| **Visitante** | Sin login | Ver home, categorías, clubes, galerías, mapa, turnos (solo lectura) |
| **Jugador** | Login con Google (Gmail) | Reservar, crear grupo, pagar, comentar/calificar, ver y aceptar Solicitudes, inscribirse a torneos |
| **Admin de grupo** | El jugador que creó la reserva | Editar jugadores/nombres/cantidad, publicar solicitud de jugador o de rival, compartir link |
| **Dueño de club** | Cuenta creada por vos (root), login con su Gmail | Cargar canchas, horarios, precios, seña mínima, galería; panel/CRM de reservas y cobros; sync con Google Calendar; crear torneos. Puede tener **varias sedes** |
| **Empleado de club** | Invitado por el dueño, login con su Gmail | Agenda, reservas manuales, comprobantes, cobros, cancelar por problema del club. **No ve ingresos ni configuración** |
| **Root (vos)** | Cuenta maestra | Alta/baja de clubes, CRM de suscripciones (pagó / no pagó), gestionar carrusel de publicidades y destacados |

---

## 3. Reglas de negocio (como las entendí — validar)

### 3.1 Estados de un turno
```
LIBRE ──(alguien lo selecciona y crea grupo)──► EN PROCESO (contador hasta el vencimiento)
EN PROCESO ──(suma de pagos ≥ seña mínima)──► CONFIRMADO  (ya no vence)
EN PROCESO ──(llega el vencimiento sin el mínimo)──► VENCIDO → vuelve a LIBRE
                                                    (normal: el club RETIENE lo pagado;
                                                     desafío: se DEVUELVE al equipo que pagó)
```
- Los demás usuarios ven el turno como **"En proceso de reserva – quedan X días"**.
- Sugerencia: permitir **"Avisame si se libera"** (lista de espera) sobre turnos en proceso.

### 3.1.b Ventanas de tiempo (regla de anticipación) — decidido 02/10/2026

Todos los plazos son **configurables por cada club**. Hay **tres parámetros de tiempo distintos** (no confundir):

| Parámetro | Qué es | Valor por defecto |
|---|---|---|
| **P = Plazo de pago** | Tiempo que tiene un grupo para juntar la seña en una reserva normal | 72 h |
| **C = Corte antes del partido** | Cuánto antes del partido tiene que estar confirmada toda reserva normal o desafío. Dentro de esta ventana empieza "Último momento" | 3 días |
| **U = Plazo de Último momento** | Tiempo para pagar la seña cuando se reserva dentro de la ventana C | 24 h |

```
  ◄─────────── más de C antes del partido ───────────►◄──── dentro de C ────►│ PARTIDO
  ·  DESAFÍO: vence en (partido − C) ─────────────────┤                     │
  ·  NORMAL:  vence en mín(creación + P, partido − C) ┤                     │
  ·                                                   │ 🔥 ÚLTIMO MOMENTO   │
  ·                                                   │ descuento del club  │
  ·                                                   │ seña dentro de U    │
```

| Tipo | ¿Cuándo se puede crear? | Vencimiento para pagar la seña | Si no se completa |
|---|---|---|---|
| **Desafío** (buscar rival) | Más de C antes del partido | **partido − C**, sin límite P (ambos equipos: conseguir rival + cada uno su mitad de la seña) | Turno se libera; se **devuelve** al equipo que pagó |
| **Normal** | Más de C antes del partido | **mín(creación + P, partido − C)** | Turno se libera; el club **retiene** lo pagado |
| **Último momento** 🔥 | Dentro de C | **mín(reserva + U, inicio del partido)** | Turno se libera; el club **retiene** lo pagado |

Ejemplos con los valores por defecto (P = 72 h, C = 3 días, U = 24 h), partido el **sábado 25 a las 21:00**:
- Desafío creado el **lunes 13** → tienen hasta el **miércoles 22 a las 21:00** para conseguir rival y que ambos paguen.
- Normal creado el **lunes 13 a las 10:00** → vence el **jueves 16 a las 10:00** (72 h).
- Normal creado el **lunes 20 a las 18:00** → vence el **miércoles 22 a las 21:00** (corte de 3 días; tiene ~51 h, no 72).
- Desde el **miércoles 22 a las 21:00** el turno libre pasa a **Último momento**.
- Último momento reservado el **jueves 23 a las 15:00** → debe pagar la seña antes del **viernes 24 a las 15:00** (24 h).
- Último momento reservado el **sábado 25 a las 12:00** → debe pagar antes de las **21:00** (empieza el partido antes de cumplirse las 24 h).

**Canchas con descuento (Último momento)**
- Nueva sección/categoría en la home y en la búsqueda: **"🔥 Último momento"**, con el precio tachado y el precio con descuento.
- Aplica a **todos** los turnos libres dentro de la ventana C (no solo a los que se cayeron). Si un desafío o una reserva normal se cae en el corte, el turno entra directo a Último momento.
- El **% de descuento lo define cada club**.
- La seña mínima (en % definido por el club) se calcula sobre el **precio con descuento**.
- Notificación push a jugadores cercanos cuando se libera un turno y entra en Último momento.

### 3.2 Grupo de juego
- El creador indica **cantidad de jugadores** y **nombres/apodos**.
- Se genera un **link compartible** (WhatsApp, copiar link, QR).
- Cada jugador ve: día, hora, club, cancha, lista, y botón **Pagar** (su parte de la seña o su parte del total, o monto libre).
- Barra de progreso: **pagado / seña mínima / total de la cancha**.

### 3.3 Edición del grupo (solo el creador)
- **Renombrar** a alguien que ya pagó → el monto queda asignado a la nueva persona.
- **Eliminar** a alguien que ya pagó → su monto se **redistribuye visualmente en partes iguales** entre los que quedan (el dinero real ya está en la cuenta del club; es solo contable).
  - Ej.: Juan pagó $6.000 y quedan 5 jugadores → cada uno recibe +$1.200 "a cuenta".
- **Agregar** jugadores → se recalcula la parte de cada uno.

### 3.4 Solicitudes
**a) Buscar jugador:** el admin publica "me falta 1 arquero / 2 jugadores", con nivel y rango de edad. Cualquier jugador registrado lo ve en **Solicitudes**, acepta y queda agregado automáticamente al grupo con su botón de pago. Ve el WhatsApp del admin.

**b) Buscar rival (Desafío):** el admin publica turno + cantidad + nivel (amateur / intermedio / profesional) + rango de edad. Un equipo acepta y aparece **su lista enfrentada** (A vs B) dentro del mismo grupo.
- La seña se divide: **seña $30.000 → $15.000 mínimo por equipo**.
- El turno queda **bloqueado para el equipo creador** mientras buscan rival.
- **Plazo único para los dos equipos: hasta el corte C antes del partido** (por defecto 3 días; conseguir rival + cada equipo su mitad de la seña), sin el límite de 72 h. El desafío solo se puede crear con **más de C de anticipación**.
- Si un equipo no llega a su mínimo → **al que sí pagó se le devuelve** (en este caso NO retiene el club).
- Ambos admins ven el WhatsApp del otro.

### 3.5 Panel del dueño (mini CRM)
- Calendario/agenda de todas sus canchas + **sincronización automática con su Google Calendar** (evento creado al confirmar, actualizado al cambiar, con link al grupo).
- Ingresos por día/semana/mes, por cancha y franja horaria.
- Click en un turno → quiénes son, cuántos, cuánto pagó cada uno, cuánto falta, estado (seña cubierta / saldado total).
- Registrar el **saldo cobrado en el club** (efectivo/transferencia en el lugar) para que el turno quede "Saldado".

### 3.6 Panel root
- Alta de clubes (vos creás la cuenta e invitás al Gmail del dueño).
- CRM de suscripciones: plan, monto mensual, **marcar pagó / no pagó**, vencimiento, historial, notas. Opción: suspender visibilidad si debe X meses.
- Gestor del **carrusel de publicidades** de la home (imagen, link, fechas de vigencia, cliente, orden) + "clubes destacados" pagos.

### 3.7 Búsqueda
- Por club (entrar a la página del club → turnos).
- **Búsqueda general** de turnos: deporte, fecha, franja horaria, zona, precio, calificación.
- **Mapa** con todos los clubes y búsqueda por cercanía (si el usuario habilita ubicación).
- **Calificaciones y comentarios** (solo usuarios registrados; idealmente solo quienes jugaron ahí → reseña "verificada").

---

## 4. ✅ Decisiones tomadas (02/10/2026)

| # | Tema | Decisión |
|---|---|---|
| 1 | **Medio de pago** | **Ambos**, y **cada club elige** en su configuración: (A) Mercado Pago (cuenta del club conectada, confirmación automática por webhook) y/o (B) Transferencia a alias/CBU + comprobante (el dueño aprueba cada pago). Un club puede tener uno o los dos activos. |
| 2 | **Plazos** | Días **corridos**, todos **configurables por club** (P, C, U). Detalle en la sección 3.1.b. |
| 3 | **Turno mientras se busca rival** | **Bloqueado para el creador.** Plazo para ambos equipos: **hasta el corte C** (por defecto 3 días antes), sin límite de 72 h. |
| 4 | **Anticipación** | Normal: vence en mín(P, corte C). Dentro de C → **Último momento**: descuento del club y seña dentro de U (24 h desde que se reserva). |
| 5 | **Comisión por reserva** | **No.** La plataforma solo cobra suscripción mensual (por fuera) + publicidades/destacados. El dinero de las reservas va 100% al club. |
| 6 | **Nombre y estilo** | "JugáYa" provisorio · estilo oscuro con verde neón. |
| 7 | **Aviso legal** | Retención de seña en T&C → **revisar con abogado antes del lanzamiento** (ver checklist sección 10). |

### 4.1 Cómo funciona cada medio de pago

**A) Mercado Pago (automático)**
- El club conecta su cuenta de MP desde su panel (OAuth de Mercado Pago). Como no hay comisión, no hace falta split: cada pago se crea directo con las credenciales del club.
- El jugador toca "Pagar" → checkout de MP → webhook → el monto se suma solo al grupo.
- Devoluciones del modo desafío: automáticas por API (o con un botón "Devolver" en el panel del dueño).

**B) Transferencia + comprobante (manual)**
- El club carga alias/CBU y titular. El jugador ve los datos, transfiere y **sube el comprobante** (foto/PDF) indicando el monto.
- El pago queda **"Pendiente de verificación"** y el dueño lo aprueba o rechaza desde su panel (con notificación).
- Propuesta: si el comprobante se sube **antes del vencimiento**, el turno **no vence** mientras el dueño no lo revise (para que el jugador no pierda el turno por demora del club). El dueño tiene Y horas para revisar (configurable).
- Devoluciones del modo desafío: el panel le muestra al dueño a quién y cuánto devolver, y él marca "Devuelto".

**Si el club tiene los dos activos**, el jugador elige al pagar. Todos los montos (MP + transferencias aprobadas + cobrado en el club) se suman en el mismo total.

### 4.2 Configuración del club (todo lo que define cada dueño)

| Grupo | Parámetro | Por defecto |
|---|---|---|
| **Plazos** | P · Plazo de pago de la seña (reserva normal) | 72 h |
| | C · Corte antes del partido (normal y desafío) | 3 días |
| | U · Plazo para pagar en Último momento | 24 h |
| **Precios** | Precio por cancha y por franja (pico/valle) | — |
| | Seña mínima (% del precio) | 50% |
| | Descuento de Último momento (%) | 20% |
| **Turnos** | Duración (60/90/120 min), días y horarios de apertura | — |
| **Pagos** | Mercado Pago (conectar cuenta) y/o transferencia (alias/CBU, titular) | — |
| | Horas para revisar comprobantes de transferencia | 12 h |
| **Políticas** | Motivos de cancelación por el club (rotura, clima, etc.) — el grupo no puede cancelar | — |
| **Desafíos** | Permitir o no el modo desafío en sus canchas | Sí |

> Validaciones del sistema: C debe ser mayor que 0, y U no puede superar C (si no, un turno de Último momento podría vencer después del partido).

### 4.3 Puntos menores que propongo resolver así (si no decís lo contrario)
- **Jugador eliminado que ya pagó:** recibe una notificación automática; su plata queda en el grupo, repartida.
- **Invitados:** para *unirse* al grupo, login con Google; para *pagar*, cualquiera con el link.
- **Cancelación:** ✅ decidido — el admin del grupo **no puede cancelar**. Solo el club, por un problema ajeno (roturas, etc.): avisa al creador por su contacto y le devuelve el dinero (FLUJOS.md F14).
- **Reserva manual del dueño** ✅ · **invitados pagan sin cuenta** ✅ · **varias sedes por dueño** ✅ · **empleados con permisos limitados** ✅ (FLUJOS.md §9–10).
- **País/moneda:** Argentina, pesos, WhatsApp. Preparado para sumar otros países más adelante.
- **Turnos:** cada club define duración (60/90/120 min), precio por cancha y por franja (pico/valle) y la seña mínima (monto fijo o %).

---

## 5. Ideas extra para que sea un "boom" 🚀

**Comunidad y enganche**
- **Perfil de jugador**: posición, nivel, deportes, partidos jugados, % asistencia, "fair play" (los compañeros lo califican). Los que faltan mucho bajan su reputación → confianza en Solicitudes.
- **Badges / logros**: "10 partidos", "Siempre paga primero", "Goleador del mes", "Arquero salvador" (aceptó 5 solicitudes de arquero).
- **Ranking de equipos** por deporte y zona (con resultados cargados en los desafíos).
- **Carga de resultado** post-partido + MVP votado → alimenta rankings.
- **Chat del grupo** dentro de la app (y botón de WhatsApp para quien prefiera).

**Para que los clubes vendan más**
- **Turno fijo semanal** (mismo día/hora todas las semanas) con reserva recurrente.
- **"Último minuto"**: turnos libres de hoy con descuento automático → notificación push a jugadores cercanos.
- **Lista de espera** sobre turnos en proceso.
- **Extras en la reserva**: alquiler de pelota, paletas, pecheras, parrilla, buffet.
- **Promos y cupones** del club, **check-in con QR** al llegar.
- **Estadísticas para el dueño**: ocupación por franja, horarios muertos, clientes frecuentes.

**Torneos y ligas** (ver sección 7)

**Crecimiento**
- Link compartible con **preview lindo** (Open Graph: foto del club, fecha, "faltan 2 jugadores").
- **Referidos**: invitá a un club o amigos → beneficios.
- Notificaciones push / email / WhatsApp: "te faltan $3.000", "quedan 12 h", "se liberó el turno que querías".
- Alerta de clima (lluvia en cancha descubierta).

**Monetización para vos**
- Suscripción mensual por planes (Básico / Pro / Premium con destacados y torneos).
- Carrusel de publicidad (clubes, marcas deportivas).
- Club destacado en búsquedas / en el mapa.
- Comisión por reserva o por inscripción a torneos (opcional).

---

## 6. Arquitectura técnica recomendada

Pensada para tener **web + APK compartiendo el mismo backend**.

| Capa | Tecnología | Por qué |
|---|---|---|
| Web | **Next.js (React) + TypeScript + Tailwind + Framer Motion** | SEO para las páginas de clubes, animaciones modernas, rápido |
| App (APK) | **React Native con Expo** | Reutiliza lógica/tipos de la web, publicación en Play Store, push notifications |
| Backend / DB | **Supabase** (PostgreSQL + Auth + Storage + Realtime + Edge Functions + cron) | Login con Google listo, fotos, actualizaciones en vivo de pagos, tareas programadas para vencer turnos |
| Login | **Google OAuth** (vía Supabase Auth) | Requisito: registro con Gmail |
| Pagos | **Mercado Pago Checkout Pro + Marketplace (split) + Webhooks** | Confirmación automática de señas, devoluciones por API |
| Calendario | **Google Calendar API** (OAuth del dueño con permiso de calendario) | Cada reserva confirmada se crea/actualiza en su calendario |
| Mapas | **Google Maps** (o Mapbox / Leaflet+OSM más barato) | Mapa, geolocalización, búsqueda por cercanía (PostGIS) |
| Hosting | **Vercel** (web) + Supabase Cloud | Deploy automático desde GitHub |
| Notificaciones | Expo Push + email (Resend) + links de WhatsApp (`wa.me`) | |

**Puntos técnicos delicados**
- **Bloqueo de turnos (concurrencia):** dos personas tocando el mismo turno a la vez → bloqueo transaccional en la base.
- **Vencimientos automáticos:** tarea programada cada minuto que pasa EN PROCESO → VENCIDO.
- **Webhooks de MP** idempotentes (que un pago no se sume dos veces).
- **Google Calendar scope**: Google exige verificar la app para permisos sensibles (trámite de ~1-4 semanas, conviene empezarlo temprano).

### Modelo de datos (borrador)
```
users(id, email, nombre, apodo, telefono_whatsapp, avatar, rol, nivel, posicion, fecha_nac)
club_members(club_id, user_id, rol [DUENIO|EMPLEADO])            ← multi-sede y empleados
activity_log(id, club_id, user_id, accion, booking_id?, created_at)  ← quién hizo qué
refunds(id, booking_id, payment_id, monto, motivo, estado [PENDIENTE|HECHA], hecho_por)
clubs(id, nombre, slug, descripcion, direccion, lat, lng, telefono, servicios[], grupo_sedes_id,
      plan, estado_suscripcion, mp_account_id, google_calendar_id, rating_prom)
club_photos(id, club_id, url, orden)
courts(id, club_id, nombre, deporte, tipo (F5/F7/pádel/…), techada, superficie)
court_schedules(court_id, dia_semana, hora_desde, hora_hasta, duracion_min, precio)
bookings(id, court_id, inicio, fin, estado [EN_PROCESO|CONFIRMADO|VENCIDO|CANCELADO|SALDADO],
         precio_total, sena_minima, vence_at, creador_id, modo [NORMAL|DESAFIO])
teams(id, booking_id, lado [A|B], admin_id, sena_minima_equipo, vence_at, estado)
team_players(id, team_id, user_id?, nombre_visible, monto_asignado, activo)
payments(id, team_player_id, booking_id, monto, mp_payment_id, estado, created_at)
requests(id, booking_id, tipo [JUGADOR|RIVAL], puesto, cantidad, nivel, edad_min, edad_max, estado)
reviews(id, club_id, user_id, estrellas, comentario, booking_id?)
subscriptions(id, club_id, periodo, monto, pagado bool, fecha_pago, nota)   ← CRM root
ads(id, titulo, imagen, link, desde, hasta, orden, cliente, activo)          ← carrusel
tournaments(id, club_id, deporte, formato, cupos, inscripcion, fechas, estado)
tournament_teams(id, tournament_id, nombre, capitan_id, pagado)
matches(id, tournament_id, ronda, team_a, team_b, court_id, inicio, goles_a, goles_b)
```

---

## 7. Plan de Torneos (módulo propio)

1. **Creación (dueño):** deporte, categoría (libre/+30/+40/femenino/mixto), nivel, formato (liga todos contra todos, eliminación directa, grupos + playoffs), cupos, precio de inscripción, fechas/canchas disponibles, premios, reglamento.
2. **Inscripción (equipos):** el capitán inscribe equipo + lista de buena fe; pago de inscripción con el mismo sistema de "cada uno paga su parte".
3. **Fixture automático:** generación de partidos asignando canchas y horarios libres del club (los bloquea en la grilla).
4. **Durante el torneo:** carga de resultados (dueño o capitanes con confirmación), tabla de posiciones y llave en vivo, goleadores, fair play.
5. **Comunicación:** notificaciones de próximos partidos, cambios de horario.
6. **Cierre:** campeón destacado en la home, badges a los jugadores, historial.

Se desarrolla **después** del MVP de reservas (Fase 4), porque reutiliza grupos, pagos y grilla de turnos.

---

## 8. Roadmap paso a paso

| Fase | Contenido | Resultado |
|---|---|---|
| **0. Definiciones** (ahora) | Responder preguntas de la sección 4, nombre/marca, colores, logo, planes de suscripción | Reglas cerradas |
| **1. Diseño** | Prototipo navegable (este HTML → versión en Figma si querés), flujos de usuario, textos | Diseño aprobado |
| **2. MVP Reservas** | Login Google, alta de clubes por root, carga de canchas/horarios/fotos, página de club, grilla de turnos, crear grupo, link compartible, pagos MP, estados y vencimientos, panel dueño básico, Google Calendar | Ya se puede reservar y cobrar |
| **3. Comunidad** | Solicitudes (jugador y rival / desafío con listas enfrentadas), WhatsApp entre admins, reseñas y calificaciones, mapa y búsqueda por cercanía, búsqueda general | El diferencial |
| **4. Negocio** | CRM root (suscripciones), carrusel de publicidades, destacados, CRM completo del dueño (ingresos, reportes) | Monetización |
| **5. Torneos** | Módulo de la sección 7 | Retención |
| **6. App Android (APK)** | Expo React Native, push notifications, publicación en Play Store (luego iOS) | App en tiendas |
| **7. Crecimiento** | Perfiles/reputación, badges, rankings, turnos fijos, último minuto, referidos | Efecto "boom" |

> Alternativa más rápida para tener APK temprano: hacer la web como **PWA** e instalarla en Android desde el navegador (o empaquetarla con Capacitor) mientras se construye la app nativa.

---

## 9. Qué necesitás (cuentas, conectores y ayudas)

**Cuentas que vas a tener que crear (las creás vos, yo te guío):**
- [ ] **GitHub**: para guardar el código.
- [ ] **Supabase**: base de datos, login y archivos.
- [ ] **Vercel**: para publicar la web.
- [ ] **Google Cloud Console**: credenciales OAuth (login), Calendar API, Maps API.
- [ ] **Mercado Pago Developers**: aplicación Marketplace, credenciales de prueba y producción.
- [ ] **Dominio** (ej. `.com.ar` en NIC Argentina).
- [ ] **Expo** + **Google Play Console** (pago único de USD 25) para la APK.

**Instalar en tu PC:** Node.js (LTS), Git, VS Code (opcional), Android Studio (para probar la APK).

**Conectores / herramientas de Claude que ayudan:**
- **Figma** (ya lo tenés disponible): pasar el prototipo a un diseño profesional editable.
- **Canva** (necesita autorización en tus conectores de claude.ai): piezas para el carrusel de publicidades y redes.
- **GitHub CLI (`gh`)**: repositorio y control de versiones.
- **Conectores MCP de Supabase y Vercel** (opcionales): me dejan crear tablas y deployar directamente.
- **Google Calendar**: el conector que aparece en tu sesión es del plugin de asesores financieros y requiere autorización; para el producto igual se usa la API de Google directamente.
- **Navegador integrado**: para probar la web mientras la construimos.

---

## 10. ✔️ Checklist antes del lanzamiento (no olvidar)

- [ ] ⚖️ **AVISO LEGAL — revisar con abogado:** retención de la seña por el club si no se completa en 72 h, devoluciones en modo desafío, política de cancelación, rol de la plataforma (no intermedia dinero), Ley de Defensa del Consumidor 24.240.
- [ ] Términos y Condiciones + Política de Privacidad (Ley 25.326 de datos personales: Gmail, teléfonos de WhatsApp, ubicación).
- [ ] Contrato/acuerdo de suscripción con los clubes.
- [ ] Verificación de la app en Google (permisos de Calendar).
- [ ] Credenciales de producción de Mercado Pago.

---

## 11. Próximo paso inmediato

1. Abrí el prototipo y recorré las pantallas (Inicio → Club → elegí un turno libre → Grupo → Solicitudes → Panel dueño → Root).
2. Respondé las preguntas de la **sección 4** (aunque sea las 1 a 4).
3. Decidí nombre provisorio y colores/estilo (¿te gusta el oscuro con verde neón del prototipo?).
4. Con eso cierro las reglas, armamos los flujos definitivos y arrancamos la Fase 2.
