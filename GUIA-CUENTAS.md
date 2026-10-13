# Guía de cuentas — Fase 2

> Las cuentas las creás vos. **Nunca pegues contraseñas ni claves secretas en el chat**: las claves se pegan directamente en `web/.env.local` o en el panel de Supabase.

- [x] **Paso 1 · GitHub** — repositorio `vecchioprofe-creator/jugaya` ✅ (código subido)
- [x] **Paso 2 · Supabase** — proyecto `cihqnbmjtrncoglvljhx` ✅
- [ ] **Paso 3 · Cargar la base de datos en Supabase**
- [ ] **Paso 4 · Conectar la web con Supabase**
- [ ] **Paso 5 · Google Cloud (login con Gmail)**
- [ ] **Paso 6 · Activar Google en Supabase y probar**
- [ ] **Paso 7 · Hacerte root**

---

## Paso 3 · Cargar la base de datos (5 minutos)

1. Entrá a tu proyecto en **https://supabase.com/dashboard/project/cihqnbmjtrncoglvljhx**.
2. Menú izquierdo → **SQL Editor** → **+ New query**.
3. En tu PC abrí el archivo `supabase/migrations/20261005000000_init.sql` (con el Bloc de notas o VS Code), **seleccioná todo (Ctrl+A), copiá (Ctrl+C)** y pegalo en el editor de Supabase.
4. Tocá **Run** (o Ctrl+Enter). Tiene que decir **"Success. No rows returned"**.
5. **+ New query** otra vez → pegá el contenido de `supabase/cron.sql` → **Run**. (Esto programa los vencimientos automáticos cada minuto.)
6. Verificá: menú **Table Editor** → tienen que aparecer las tablas `profiles`, `clubs`, `bookings`, etc.

> Si aparece un error, copiame **el mensaje de error** (no tiene datos secretos) y lo resuelvo.

---

## Paso 4 · Conectar la web con Supabase (2 minutos)

1. En Supabase: **Project Settings (⚙️) → API Keys**.
2. Copiá la **Publishable key** (empieza con `sb_publishable_…`). Si tu panel muestra "anon public", usá esa.
3. En tu PC abrí `web/.env.local` y pegala después del `=` en la línea:
   ```
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   ```
4. Guardá el archivo. (La **Secret key** no la pegues todavía.)

---

## Paso 5 · Google Cloud: credenciales para "Ingresar con Google" (15 minutos)

1. Entrá a **https://console.cloud.google.com** con tu Gmail.
2. Arriba a la izquierda, selector de proyectos → **New project** → nombre `jugaya` → **Create**. Asegurate de que quede seleccionado.
3. Menú ☰ → **APIs & Services → OAuth consent screen** (o "Google Auth Platform → Branding"):
   - App name: `JugáYa`
   - User support email: tu Gmail
   - Audience / User type: **External**
   - Developer contact: tu Gmail → **Save / Create**.
4. **Clients** (o "Credentials → + Create credentials → OAuth client ID"):
   - Application type: **Web application**
   - Name: `JugáYa web`
   - **Authorized JavaScript origins** → Add URI: `http://localhost:3000`
   - **Authorized redirect URIs** → Add URI (exacto, copialo de acá):
     ```
     https://cihqnbmjtrncoglvljhx.supabase.co/auth/v1/callback
     ```
   - **Create**.
5. Te muestra un **Client ID** y un **Client secret**. **No me los pases**: los vas a pegar en Supabase en el paso 6. (Podés descargar el JSON para tenerlos guardados.)
6. Mientras la app esté en modo "Testing", en **Audience → Test users** agregá tu Gmail (y el de quien quieras que pruebe).

---

## Paso 6 · Activar Google en Supabase y probar (5 minutos)

1. Supabase → **Authentication → Sign In / Providers → Google** → activalo (**Enable**).
2. Pegá el **Client ID** y el **Client secret** del paso 5 → **Save**.
3. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs** → Add URL: `http://localhost:3000/auth/callback`
4. En tu PC, reiniciá la web (cerrá y volvé a abrir el servidor) y entrá a **http://localhost:3000** → **Ingresar con Google**.
5. Si todo salió bien, arriba a la derecha aparece **tu foto** y el botón **Salir**. 🎉

---

## Paso 7 · Hacerte administrador root (1 minuto)

Después de ingresar una vez con Google:
1. Supabase → **SQL Editor** → **+ New query** → pegá (cambiando por tu Gmail):
   ```sql
   update profiles set es_root = true where email = 'TU_GMAIL@gmail.com';
   ```
2. **Run** → tiene que decir "1 row affected".

---

## Paso 8 · Actualizar la base: panel root (2 minutos)

1. Supabase → **SQL Editor** → **+ New query**.
2. Pegá el contenido de `supabase/migrations/20261013000000_root_clubes.sql` → **Run** → "Success".
3. En la web, recargá: arriba aparece el enlace **Root** (solo para vos) → creá tu primer club.

---

## Más adelante
- **Mercado Pago Developers** (pagos) · **Vercel** (publicar la web) · **Google Maps API** (mapa).
