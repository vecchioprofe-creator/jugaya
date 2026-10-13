# JugáYa — Flujos pantalla por pantalla

> Complementa [PLAN.md](PLAN.md). Las reglas de tiempo (P, C, U) están en PLAN.md §3.1.b.
> Convención: **[Pantalla]** · `estado` · ➜ acción · ⚙️ lo hace el sistema solo · 🔔 notificación.

---

## 0. Mapa de pantallas

```
PÚBLICO (sin login)                    JUGADOR (login Google)              DUEÑO DE CLUB                 ROOT
─────────────────────                  ──────────────────────              ─────────────                 ────
P1  Inicio                             J1  Completar perfil                D1  Activar cuenta (wizard)   R1  Dashboard
P2  Categoría (deporte)                J2  Mis reservas / grupos           D2  Inicio (resumen del día)  R2  Clubes (listado)
P3  Búsqueda general de turnos         J3  Grupo de juego (vista privada)  D3  Agenda / grilla           R3  Crear / editar club
P4  Mapa                               J4  Pagar (MP o transferencia)      D4  Detalle de reserva        R4  Suscripciones (CRM)
P5  Último momento 🔥                   J5  Solicitudes (tablero)           D5  Comprobantes a revisar    R5  Publicidades (carrusel)
P6  Página del club                    J6  Crear solicitud                 D6  Ingresos (CRM)            R6  Destacados
P7  Grupo (vista pública del link)     J7  Notificaciones                  D7  Reseñas                   R7  Moderación de reseñas
P8  Torneos (listado / detalle)        J8  Mi perfil público               D8  Configuración del club
                                       J9  Escribir reseña                 D9  Torneos (crear / gestionar)
                                       J10 Inscripción a torneo
```

Navegación principal — **Web:** barra superior. **App:** barra inferior con 5 íconos: Inicio · Buscar · Solicitudes · Mis partidos · Perfil.

---

## 1. Flujos del JUGADOR

### F1 · Descubrir y buscar
**[P1 Inicio]**
1. Carrusel de publicidades (desde R5) · buscador rápido (deporte, fecha, horario, zona) · categorías · clubes destacados · 🔥 Último momento · mapa "Cerca tuyo" · solicitudes abiertas · torneos.
2. ➜ Categoría → **[P2]**: clubes de ese deporte (con animación de entrada) + filtros.
3. ➜ "Buscar turnos" → **[P3]**.

**[P3 Búsqueda general]** (turnos de **todos** los clubes)
- Filtros: deporte · tipo de cancha (F5/F7/techada…) · fecha · franja horaria · distancia · precio máx. · calificación mín. · "solo Último momento".
- Orden: más cerca · más barato · mejor calificado · más temprano.
- Cada resultado: club, cancha, hora, precio (tachado si tiene descuento), distancia, ★.
- ➜ Tocar resultado → **[P6]** con ese día y turno ya marcados.

**[P4 Mapa]**
- Si el navegador/app tiene ubicación → centra en el usuario y ordena por distancia. Si la niega → pide zona/barrio a mano.
- Pines por deporte · ➜ pin → mini ficha (★, turnos libres hoy) → **[P6]**.

**[P5 Último momento 🔥]**
- Solo turnos libres dentro del corte C de cada club, con % de descuento y la leyenda "Seña dentro de 24 h".
- ➜ "Avisarme" (ver F12): alerta cuando aparezca un turno de Último momento cerca.

### F2 · Login y perfil
**Disparador:** cualquier acción que requiera cuenta (reservar, sumarse, pagar desde la cuenta, reseñar, publicar solicitud).
1. Modal "Ingresá con Google" → OAuth de Google.
2. **Primer ingreso → [J1 Completar perfil]** (obligatorio, 1 pantalla):
   - Nombre y **apodo** (se muestra en los grupos) · **WhatsApp** (obligatorio: lo ven los admins con quienes juega) · fecha de nacimiento (para los rangos de edad) · deportes · posición y nivel por deporte (opcional).
   - Aceptar **Términos y Condiciones** (incluye la retención de seña ⚖️).
3. Vuelve exactamente a la acción que había iniciado.

### F3 · Página del club
**[P6 Club]**
- Portada con foto, nombre, ★ y reseñas, dirección (abre Google Maps), distancia, botón WhatsApp del club, medios de pago aceptados.
- Pestañas: **Turnos** (por defecto) · Galería · Servicios · Canchas y precios · Opiniones · Torneos del club.
- **Grilla de turnos:** selector de día (14 días hacia adelante) × canchas × horarios. Estado de cada celda:

| Celda | Qué ve el usuario | Al tocar |
|---|---|---|
| 🟢 Libre | precio | ➜ F4 Reservar |
| 🔥 Libre con descuento | precio tachado + % | ➜ F10 Último momento |
| 🟡 En proceso | "Reservando · quedan 2 d 5 h" | Tooltip + botón "Avisame si se libera" |
| ⚔️ Busca rival | "Desafío · nivel intermedio" | ➜ ver la solicitud (F9) |
| ⚫ Reservado | tachado | — |
| 🔒 Bloqueado por el club | gris | — |

### F4 · Reservar un turno (normal o desafío)
**[P6] ➜ celda libre** (si no hay sesión → F2 y vuelve).

⚙️ El sistema calcula el **tipo** según cuánto falta para el partido:
- Faltan **más que C** → reserva **Normal** o **Desafío** (el usuario elige).
- Falta **menos que C** → **Último momento** (F10).

**[Modal Reservar] — paso 1: Resumen**
- Club, cancha, día, hora, duración, precio, **seña mínima**, y la **fecha y hora exactas de vencimiento** calculadas ("Tenés hasta el jue 16/10 10:00").

**Paso 2: Modalidad**
- 👥 **Partido entre amigos** (normal).
- ⚔️ **Buscar equipo rival** (desafío): solo aparece si el club lo permite. Muestra "Plazo para conseguir rival y pagar ambos: hasta el mié 22/10 21:00".

**Paso 3: Jugadores**
- Cantidad (stepper; sugerida según la cancha: F5 → 10 normal / 5 por equipo en desafío).
- Nombres o apodos (el creador aparece primero, ya cargado). Se pueden dejar lugares "a completar".
- Desafío: además, nombre del equipo + nivel + rango de edad + comentario (esto arma la solicitud de rival).

**Paso 4: Confirmar**
- ✅ Checkbox de condiciones: "Si no se completa la seña antes de [fecha] el turno se libera y [el club retiene lo pagado | se devuelve lo pagado (desafío)]".
- ➜ "Crear grupo y bloquear turno".
- ⚙️ Bloqueo transaccional del turno (si otro lo tomó un segundo antes → "Ese turno se acaba de ocupar" y vuelve a la grilla).
- ⚙️ Turno → `EN_PROCESO` (o `BUSCA_RIVAL` en desafío) · se crea el grupo y el link · desafío: se publica la solicitud en **[J5]**.
- 🔔 Al creador: "Turno bloqueado hasta [fecha]".
- → **[J3 Grupo]** con un banner "Compartí el link con tu equipo" (WhatsApp / copiar / QR).

### F5 · Grupo de juego
**Link:** `jugaya.app/g/K7PX-29` (con vista previa linda al compartir: foto del club, fecha y "faltan $X").

**Quién ve qué:**

| Visitante | Ve | Puede |
|---|---|---|
| Sin login | Club, fecha, hora, lista de apodos, progreso, estado | **Pagar la parte de un jugador** (elige su nombre en la lista) · Ingresar |
| Logueado, no está en la lista | Lo mismo | "Soy yo" → vincular su cuenta a un nombre de la lista (el creador lo aprueba) · Pagar |
| Jugador de la lista | + WhatsApp del admin | Pagar · Salir del grupo |
| **Creador (admin)** | + todo | Editar jugadores (F7) · Solicitar jugador (F8) · Compartir (no puede cancelar) |
| Admin del equipo rival | + WhatsApp del otro admin | Editar **su** lista · Pagar |

**[J3 Grupo] — contenido:**
- Encabezado: fecha, hora, club, cancha · **estado** · **cuenta regresiva** al vencimiento.
- Barra: recaudado / seña mínima / total.
- Normal: una lista. Desafío: **dos listas enfrentadas (A vs B)**, cada una con su barra hacia **seña ÷ 2**.
- Cada jugador: avatar, apodo, monto pagado, estado (Sin pagar · Cubrió su seña · Pagó su total · ⏳ Comprobante en revisión) y botón **Pagar**.

**Estados del grupo (lo que muestra el encabezado):**

| Estado | Texto | Color |
|---|---|---|
| `EN_PROCESO` | "En proceso · quedan 2 d 14 h · faltan $12.000" | 🟡 |
| `BUSCA_RIVAL` | "Esperando rival · hasta mié 22/10 21:00" | ⚔️ |
| `CONFIRMADO` | "¡Turno confirmado! Falta saldar $30.000 en el club" | 🟢 |
| `SALDADO` | "Todo pago 🎉" | 🟢 |
| `VENCIDO` | "No se llegó a la seña · el turno se liberó" | 🔴 |
| `CANCELADO_CLUB` | "El club canceló el turno: [motivo]. Se van a comunicar con [admin] para devolver lo pagado" | ⚫ |
| `JUGADO` | "¿Cómo estuvo? Calificá al club" (+ resultado en desafío) | — |

### F6 · Pagar
**[J3] ➜ Pagar** (en el nombre de un jugador) → **[J4 Pagar]**
1. Opciones de monto: **Su parte de la seña** · **Su parte del total** · **Lo que falta de la seña** (bancar a todos) · **Otro monto**.
   ⚙️ Tope: no se puede pagar más que lo que falta del total.
2. Si el club tiene los dos medios → el jugador elige:

**A) Mercado Pago**
- ➜ Checkout de MP (con la cuenta del club) → vuelve al grupo.
- ⚙️ Llega el webhook → se suma el monto → 🔔 al admin "Rami pagó $3.000" · 🔔 al club.
- ⚙️ Si el total ≥ seña mínima → `CONFIRMADO` → 🔔 a todo el grupo + evento en el **Google Calendar del club** + confeti 🎉.

**B) Transferencia**
- Muestra alias/CBU/titular (botón copiar) y el monto.
- ➜ El jugador transfiere desde su banco y **sube el comprobante** (foto/PDF) + monto.
- ⚙️ Pago `EN_REVISION` → 🔔 al dueño. Si se sube antes del vencimiento, el turno **no vence** mientras el dueño no lo revise (máx. las horas configuradas).
- Dueño aprueba → se suma (igual que MP). Rechaza (con motivo) → 🔔 al jugador "Tu comprobante fue rechazado: [motivo]".

### F7 · Editar el grupo (solo el admin, sobre su propia lista)
| Acción | Efecto | Notificación |
|---|---|---|
| ✏️ Renombrar | El monto pagado **queda para la nueva persona** | — |
| 🗑️ Eliminar (no pagó) | Se recalcula la parte de cada uno | 🔔 al eliminado si tenía cuenta |
| 🗑️ Eliminar (sí pagó) | Confirmación: "Sus $6.000 se reparten: +$1.500 a cada uno de los 4" → **redistribución visual en partes iguales** | 🔔 al eliminado: "Te quitaron del grupo; tu pago quedó en el grupo" |
| ➕ Agregar | Nuevo lugar con $0 | — |


> ❌ **El admin del grupo NO puede cancelar la reserva** (decidido). Si el grupo no paga, el turno vence solo. La única cancelación posible es **la del club por un problema ajeno** (ver F14 · Cancelación por el club).

### F8 · Solicitar jugador / Sumarse
**Admin — [J3] ➜ "Solicitar jugador" → [J6 Crear solicitud]**
- Cantidad · puesto (opcional) · nivel · rango de edad · comentario. Se publica en **[J5]**.
- Se cierra sola cuando se completan los lugares, cuando vence el turno o cuando el admin la da de baja.

**Jugador — [J5 Solicitudes] (pestaña "Buscan jugador")**
- Filtros: deporte · fecha · distancia · nivel · puesto · edad (por defecto, **se muestran primero las que coinciden con su perfil**).
- Cada tarjeta: puesto, club, fecha y hora, nivel, edad, "tu parte: $X", quién la publica.
- ➜ **"Sumarme"** → confirmación → ⚙️ queda agregado a la lista con $0 y su botón de pago → 🔔 al admin "Lucas se sumó como arquero" → ve el **WhatsApp del admin**.
- Si su edad o nivel no coincide → igual puede sumarse, pero con un aviso ("Buscan 25–35 años").

### F9 · Desafío (buscar rival)
**Creación:** en F4, paso 2 → ⚔️ (o desde un grupo normal que todavía está antes del corte C ➜ "Buscar rival": la lista actual pasa a ser el equipo A).

**Equipo rival — [J5] pestaña "Buscan rival"**
1. Tarjeta: equipo A, club, fecha, formato (5 vs 5), nivel, edad, "Seña por equipo: $15.000", plazo.
2. ➜ **"Aceptar desafío"** → modal: nombre del equipo · cantidad y apodos · WhatsApp del admin B.
3. ⚙️ Se agrega la **lista B enfrentada** · la solicitud se cierra · estado `EN_PROCESO` (los dos equipos ya están) · 🔔 al admin A "¡Tenés rival: La Naranja Mecánica!" · cada admin ve el WhatsApp del otro.
4. Cada equipo junta su mitad. ⚙️ Se confirma cuando **A ≥ seña ÷ 2 y B ≥ seña ÷ 2**.

**Vencimiento (en el corte C):**
- Ninguno, o solo uno, llegó a su mitad → turno se libera (entra a Último momento) · ⚙️ **devolución** de lo pagado: MP → reembolso automático; transferencia → tarea "Devolver $X a [jugador]" en el panel del dueño **[D4]** · 🔔 a todos.
- Si nunca apareció rival → igual: se libera y se devuelve.
- Si el equipo A quiere jugar igual sin rival: antes del corte puede pasar a **reserva normal** ("Jugamos entre nosotros") y pagar la seña completa.

**Después del partido:** cada admin carga el resultado; si coinciden → queda registrado (alimenta rankings y perfiles).

### F10 · Último momento 🔥
- Mismo flujo que F4, pero: precio con descuento · solo modalidad normal · plazo de pago **mín(24 h, inicio del partido)** · cuenta regresiva en horas.
- Si se reserva con muy poco margen (ej. falta 1 h), se sugiere pagar todo al instante.

### F11 · Reseñas
- ⚙️ Cuando un turno pasa a `JUGADO` → 🔔 "¿Cómo estuvo [club]?" a los jugadores con cuenta.
- **[J9]**: estrellas (general + opcionales: canchas, vestuarios, atención) + comentario + fotos.
- Solo pueden reseñar quienes jugaron → sello "✔ Jugó acá". El club puede responder (D7); root modera (R7).

### F12 · Mi cuenta
- **[J2 Mis partidos]**: próximos (con estado y cuenta regresiva) · pendientes de pago · historial · desafíos.
- **[J7 Notificaciones]**: centro de notificaciones + preferencias (push / email).
- **[J8 Perfil]**: apodo, foto, deportes, posición, nivel, partidos jugados, asistencia, reseñas de compañeros (fase Comunidad).
- **Alertas**: "Avisame si se libera este turno" · "Avisame de Último momento en [deporte] cerca mío".

---

## 2. Flujos del DUEÑO DE CLUB

### F13 · Activación de la cuenta
1. Root lo crea (F20) → 🔔 email al Gmail del dueño con link de activación.
2. Login con Google (tiene que ser **ese** Gmail).
3. **[D1 Wizard]** — 6 pasos, con barra de progreso; se puede guardar y seguir después:
   1. **Datos:** nombre, descripción, dirección (autocompletar + pin en el mapa), WhatsApp, horario de atención, servicios (checklist con íconos).
   2. **Fotos:** portada + galería (arrastrar y ordenar).
   3. **Canchas:** nombre, deporte, tipo, techada/descubierta, superficie, capacidad.
   4. **Horarios y precios:** por cancha → días, horario, duración del turno, precio por franja (pico/valle).
   5. **Reglas:** seña %, P, C, U, descuento de Último momento %, política de cancelación, permitir desafíos (con los valores por defecto ya cargados y una explicación simple de cada uno).
   6. **Cobros e integraciones:** conectar Mercado Pago y/o cargar alias/CBU · conectar **Google Calendar** (elegir calendario).
4. Vista previa de su página → ➜ "Publicar". (Root puede exigir que esté al día con la suscripción para publicar.)

### F14 · Operación diaria
**[D2 Inicio]**: turnos de hoy (hora, cancha, grupo, estado de pago) · ⚠️ alertas (comprobantes por revisar, turnos que vencen hoy, devoluciones pendientes) · ingresos de hoy y del mes.

**[D3 Agenda]**: vista día / semana · filas = canchas · colores por estado (igual que la grilla pública) · arriba, filtros por cancha.
- ➜ Celda ocupada → **[D4]**.
- ➜ Celda libre → **Reserva manual** (para quien llama por teléfono o llega al club): nombre, teléfono, monto cobrado → queda `CONFIRMADO` y sincroniza con Calendar.
- ➜ Celda libre → **Bloquear** (mantenimiento, clase, evento) con motivo y repetición.

**[D4 Detalle de reserva]**
- Grupo/equipos, cantidad de jugadores, cada jugador con su monto y estado de pago · barra seña/total · historial de pagos (fecha, medio, comprobante).
- Acciones: ✅ aprobar/rechazar comprobantes · 💵 **Registrar cobro en el club** (efectivo/transferencia en el lugar → hasta `SALDADO`) · ↩️ marcar devolución hecha · ❌ cancelar por problema del club · 💬 WhatsApp del admin del grupo · 📅 ver en Google Calendar.

**Cancelación por el club (problema ajeno: rotura, inundación, corte de luz, etc.)**
1. **[D4] ➜ "Cancelar turno"** → motivo (lista + texto libre) → confirmar.
2. ⚙️ Turno → `CANCELADO_CLUB` · se borra el evento de Google Calendar · 🔔 a todo el grupo con el motivo.
3. El panel muestra el **WhatsApp del creador** (botón directo) y crea la tarea **"Devolver $X"** con el detalle de cuánto pagó cada jugador.
4. El club se comunica con el creador y acuerda la devolución (o reprogramar a otro turno, si el grupo prefiere) → ➜ **"Marcar devuelto"** (MP: puede usar el reembolso automático desde el mismo botón).
5. ⚙️ Si la devolución sigue pendiente después de 48 h → recordatorio al dueño (y aviso a root, opcional).

**[D5 Comprobantes]**: bandeja de transferencias por revisar (imagen + monto + jugador + turno) → Aprobar / Rechazar con motivo. Contador de horas restantes para revisar.

### F15 · CRM de ingresos
**[D6 Ingresos]**
- Totales por período (día/semana/mes/rango) · por cancha · por franja horaria · por medio de pago (MP / transferencia / en el club).
- Señas cobradas vs. saldos cobrados · **retenido por vencimientos** · devuelto en desafíos.
- Ocupación % por cancha y franja (para ver horarios muertos → sugerencia: "subí el descuento de Último momento").
- Tabla de reservas filtrable → clic → D4. Exportar a Excel/CSV.

### F16 · Configuración, reseñas y torneos
- **[D8]**: las mismas secciones del wizard, editables. Los cambios de reglas aplican **solo a reservas nuevas**.
- **[D7]**: reseñas recibidas, responder públicamente, denunciar una reseña a root.
- **[D9 Torneos]**: ver §4.

---

## 3. Flujos del ROOT

### F20 · Alta de club
**[R2] ➜ "Crear club" → [R3]**: nombre del club · **Gmail del dueño** · plan · monto mensual · día de vencimiento · notas → ⚙️ email de invitación → el club aparece en estado `PENDIENTE_ACTIVACION`.

### F21 · CRM de suscripciones
**[R4]**: tabla mensual con club · plan · monto · vencimiento · **¿pagó? (switch)** · fecha de pago · medio · nota.
- Filtros: al día / debe / vence esta semana. Totales: cobrado, pendiente.
- Historial por club (todos los meses).
- Acción opcional: **Suspender** (la página deja de mostrarse en búsquedas; las reservas existentes se respetan) / Reactivar.
- ⚙️ Recordatorio a root: "3 clubes vencen esta semana".

### F22 · Publicidades y destacados
**[R5 Carrusel]**: imagen (desktop + mobile), título, texto, botón y link (a un club, torneo o externo), cliente, fecha desde/hasta, orden, activa/pausada. Vista previa. ⚙️ Se activa/desactiva sola por fechas.
**[R6 Destacados]**: elegir clubes destacados (badge ★ + primeros en búsquedas y mapa) con vigencia.

### F23 · Panel general
**[R1]**: clubes activos · reservas del mes en toda la plataforma · usuarios nuevos · suscripciones cobradas/pendientes · publicidades activas. **[R7]**: reseñas denunciadas → mantener / ocultar.

---

## 4. Torneos (fase 5) — flujo resumido
1. **Dueño [D9]** ➜ Crear: deporte, categoría, nivel, formato (liga / eliminación / grupos + playoffs), cupos, inscripción $, fechas y canchas a usar, reglamento, premios → ⚙️ reserva esos turnos en la grilla.
2. **Publicación** en [P8] y en el carrusel (si paga publicidad).
3. **Capitán [J10]** ➜ Inscribir equipo: nombre, escudo, lista de buena fe → grupo de pago igual a F5/F6 (cada uno paga su parte de la inscripción) → ⚙️ inscripción confirmada al llegar al monto.
4. Al cerrar la inscripción ➜ ⚙️ **fixture automático** (partidos con cancha y horario).
5. Durante el torneo: el dueño carga resultados (o los capitanes, y el dueño confirma) → tabla, llave y goleadores en vivo · 🔔 "Tu próximo partido: sáb 20:00, Cancha 2".
6. Cierre: campeón destacado en la home + badges.

---

## 5. Procesos automáticos ⚙️ (corren solos)

| Proceso | Cuándo | Qué hace |
|---|---|---|
| Vencimiento de reservas | Cada minuto | `EN_PROCESO` / `BUSCA_RIVAL` con vencimiento pasado (y sin comprobantes en revisión) → `VENCIDO`, turno libre · desafío: dispara devoluciones |
| Recordatorios de pago | 24 h, 6 h y 1 h antes de vencer | 🔔 al grupo: "Faltan $X · quedan 6 h" (con link) |
| Entrada a Último momento | Cada hora | Marca turnos libres que entran en la ventana C y aplica el descuento · 🔔 alertas a interesados |
| Webhooks de MP | Cada pago | Suma el pago (sin duplicar), evalúa la confirmación |
| Google Calendar | Al confirmar / cambiar / cancelar | Crea, actualiza o borra el evento en el calendario del club |
| Revisión de comprobantes | Cada hora | Recuerda al dueño; si se pasa del plazo de revisión → 🔔 a root (opcional) |
| Post-partido | Al terminar el turno | `JUGADO` → pide reseña y resultado (desafío) |
| Publicidades | Diario | Activa/desactiva por fechas |

---

## 6. Diagramas de estados

**Reserva**
```
                 ┌─────────────(nunca aparece rival / alguno no paga su mitad · devolución)──────────┐
                 │                                                                                    ▼
LIBRE ─► BUSCA_RIVAL ─(acepta rival)─► EN_PROCESO ─(seña cubierta)─► CONFIRMADO ─► SALDADO ─► JUGADO
  ▲                                        │                              │
  │                                        ├─(vence sin seña · club retiene)─► VENCIDO ──┐
  │                       (cualquier estado activo)─(el club cancela · devuelve)─► CANCELADO_CLUB ─┤
  └──────────────────────────────────── el turno vuelve a estar libre ◄────────────────┘
```

**Pago**: `INICIADO` → `APROBADO` | `RECHAZADO` | (transferencia) `EN_REVISION` → `APROBADO` | `RECHAZADO` → (desafío caído) `DEVUELTO`.

**Solicitud**: `ABIERTA` → `COMPLETA` | `CERRADA_POR_ADMIN` | `VENCIDA`.

**Suscripción del club**: `PENDIENTE_ACTIVACION` → `ACTIVA` ⇄ `DEBE` → `SUSPENDIDA`.

---

## 7. Notificaciones 🔔 (resumen)

| Evento | Jugadores del grupo | Admin del grupo | Dueño | Root |
|---|---|---|---|---|
| Turno bloqueado | — | ✔ | ✔ (en el panel) | — |
| Alguien pagó | — | ✔ | ✔ | — |
| Seña cubierta / confirmado | ✔ | ✔ | ✔ + Calendar | — |
| Faltan X horas para vencer | ✔ | ✔ | — | — |
| Venció / se liberó | ✔ | ✔ | ✔ | — |
| Se sumó un jugador (solicitud) | — | ✔ | — | — |
| Apareció rival | — | ✔ (los dos) | ✔ | — |
| Comprobante por revisar / rechazado | el que pagó | — | ✔ | — |
| Te eliminaron del grupo | el afectado | — | — | — |
| Turno de Último momento cerca | interesados | — | — | — |
| Club debe la suscripción | — | — | ✔ (opcional) | ✔ |

Canales: push (app) · email · en la web, centro de notificaciones. WhatsApp: botones `wa.me` para hablar con una persona (no mensajes automáticos en el MVP).

---

## 8. Casos borde ya resueltos
- **Dos personas tocan el mismo turno a la vez** → gana la primera; la segunda ve "se acaba de ocupar".
- **Pago que llega después del vencimiento** (MP demorado) → se acepta si el pago se **inició** antes del vencimiento y el turno sigue libre; si ya lo tomó otro grupo → devolución automática.
- **El club cambia precios o reglas** → no afecta a reservas existentes.
- **El club cancela un turno** (rotura, problema) → 🔔 a todos; el club se comunica con el creador y gestiona la devolución o la reprogramación desde D4.
- **El grupo quiere bajarse** → no hay botón de cancelar; si no completan la seña, vence sola. Si ya está confirmado, lo hablan directamente con el club (WhatsApp).
- **Un jugador está en dos grupos a la misma hora** → aviso, pero se permite.
- **Pagos de más** → el sistema no deja pagar por encima del total.
- **El admin quiere irse del grupo** → tiene que pasar el rol de admin a otro jugador con cuenta.

---

## 9. Decisiones finales (02/10/2026)
1. **Reserva manual del dueño:** ✅ sí, en el MVP.
2. **Invitados sin cuenta pueden pagar desde el link:** ✅ sí.
3. **Cancelación:** el admin del grupo **no puede cancelar**. Solo el club cancela por problema ajeno → se comunica con el creador y le devuelve el dinero (ver F14).
4. **Varios clubes/sedes por dueño:** ✅ sí → ver F17.
5. **Empleados:** ✅ sí → ver F17.

---

## 10. Multi-sede y empleados

### F17 · Dueño con varias sedes
- Root crea cada sede como un club (F20) y la asigna al **mismo Gmail** del dueño. La suscripción se lleva **por sede** en el CRM de root (cada sede puede tener su plan).
- En el panel del dueño, arriba: **selector de sede** ("Todas" / El Potrero Avellaneda / El Potrero Quilmes).
  - "Todas" → ingresos y ocupación consolidados; agenda filtrable por sede.
- Para el jugador cada sede es una página de club independiente (con su propia dirección, fotos, reseñas y reglas), con el texto "Otras sedes de este club" para pasar de una a otra.

### F18 · Empleados (encargados)
- **[D8 Configuración] ➜ Equipo ➜ "Invitar empleado"**: Gmail + sedes a las que tiene acceso → 🔔 email de invitación → entra con su Google.
- Permisos:

| Puede | Dueño | Empleado |
|---|---|---|
| Ver agenda y detalle de reservas | ✅ | ✅ |
| Reserva manual / bloquear cancha | ✅ | ✅ |
| Aprobar/rechazar comprobantes | ✅ | ✅ |
| Registrar cobros en el club | ✅ | ✅ |
| Cancelar un turno por problema del club | ✅ | ✅ (queda registrado quién) |
| Marcar devoluciones | ✅ | ✅ |
| **Ver ingresos / CRM / exportar** | ✅ | ❌ |
| **Configuración** (precios, reglas, cobros, fotos) | ✅ | ❌ |
| Invitar o quitar empleados | ✅ | ❌ |
| Responder reseñas | ✅ | ❌ |

- ⚙️ **Registro de actividad**: cada acción de un empleado queda registrada (quién, qué, cuándo) y el dueño la ve en D4 y en un historial.
