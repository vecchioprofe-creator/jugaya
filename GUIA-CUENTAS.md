# Guía de cuentas — Fase 2

> Las cuentas las creás vos. **Nunca pegues contraseñas ni claves secretas en el chat**: cuando haga falta una clave, la vas a pegar vos mismo en el archivo `web/.env.local` (que no se sube a internet).

---

## Paso 1 · GitHub (guardar el código)

1. Entrá a **https://github.com/signup** y registrate (podés usar tu Gmail).
2. Verificá el email y elegí el plan **Free**.
3. Creá un repositorio: botón **"+" → New repository**
   - Nombre: `jugaya`
   - Visibilidad: **Private** (privado)
   - **No** marques "Add a README" ni ".gitignore" (ya los tenemos).
   - ➜ **Create repository**.
4. Copiá la dirección que aparece (tipo `https://github.com/TU-USUARIO/jugaya.git`) y **pasámela en el chat** (esa sí se puede compartir).

✅ Listo cuando: me pasaste la dirección del repositorio.

---

## Paso 2 · Supabase (base de datos + login + fotos)

1. Entrá a **https://supabase.com** → **Start your project** → **Continue with GitHub** (usa la cuenta del paso 1).
2. Te pide crear una **organización**: nombre `JugaYa`, tipo **Personal**, plan **Free**.
3. **New project**:
   - Name: `jugaya`
   - Database password: tocá **Generate a password** y **guardala en un lugar seguro** (gestor de contraseñas o papel). No me la pases.
   - Region: **South America (São Paulo)** — la más cercana a Argentina.
   - ➜ **Create new project** (tarda 1–2 minutos).
4. Cuando termine, andá a **Project Settings (⚙️) → API** (o "Data API" / "API Keys") y buscá:
   - **Project URL** (tipo `https://abcdxyz.supabase.co`) → **pasámela en el chat** (es pública).
   - **anon / publishable key** → es pública, pero igual la vas a pegar vos en `web/.env.local` (te aviso cuándo).
   - **service_role / secret key** → ⚠️ **secreta**. No la compartas con nadie. La vamos a usar más adelante.

✅ Listo cuando: me pasaste la Project URL.

---

## Paso 3 · Google Cloud (login con Gmail, Calendar y Maps) — *lo hacemos juntos después de Supabase*

Resumen de lo que vamos a hacer (no hace falta que lo hagas todavía):
1. Crear un proyecto en **https://console.cloud.google.com** llamado `jugaya`.
2. Configurar la **pantalla de consentimiento OAuth** (nombre de la app, tu email, logo).
3. Crear credenciales **OAuth Client ID (Web)** con la dirección de retorno que nos da Supabase.
4. Activar las APIs: **Google Calendar API** y **Maps JavaScript API / Places API**.
5. Pegar el Client ID y Client Secret en Supabase → Authentication → Providers → Google.

---

## Paso 4 · Mercado Pago Developers — *más adelante (pagos)*
## Paso 5 · Vercel (publicar la web) — *más adelante*

---

### Checklist
- [ ] GitHub creado + repositorio `jugaya` privado
- [ ] Supabase creado + proyecto `jugaya` en São Paulo
- [ ] Contraseña de la base guardada en lugar seguro
- [ ] Google Cloud (paso 3, juntos)
