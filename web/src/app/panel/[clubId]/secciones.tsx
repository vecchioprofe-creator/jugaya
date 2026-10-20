"use client";

import { useActionState, useState, useTransition } from "react";
import { DEPORTES } from "@/lib/deportes";
import { crearClienteNavegador } from "@/lib/supabase/navegador";
import {
  actualizarCancha, borrarFoto, crearCancha, elegirPortada, guardarCobros, guardarDatos, guardarHorarios,
  guardarReglas, publicarClub, registrarFoto, type EstadoFormulario, type FranjaForm,
} from "./acciones";

export type CanchaPanel = { id: string; nombre: string; deporte: string; tipo: string; techada: boolean; activa: boolean; franjas: FranjaForm[] };
export type ClubPanel = {
  id: string; slug: string; nombre: string; estado: string;
  descripcion: string; direccion: string; barrio: string; whatsapp: string; horario: string; servicios: string[];
  portada: string | null;
  reglas: { senaPct: number; plazoPagoHoras: number; corteHoras: number; plazoUmHoras: number; descuentoUmPct: number; permiteDesafios: boolean };
  cobros: { mercadoPago: boolean; transferencia: boolean; alias: string; cbu: string; titular: string };
  fotos: { id: string; url: string }[];
  canchas: CanchaPanel[];
};

const SERVICIOS = ["🚿 Vestuarios", "🅿️ Estacionamiento", "🍔 Buffet", "🔥 Parrilla", "💡 Luz LED", "📶 Wi-Fi", "🧤 Alquiler de pecheras", "🎾 Alquiler de paletas", "♿ Accesible", "❄️ Climatizado"];
const DIAS = ["D", "L", "M", "X", "J", "V", "S"]; // 0 = domingo
const HORAS = Array.from({ length: 37 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`;
}); // 06:00 … 24:00

const campo = "w-full rounded-xl border border-line bg-bg2 px-3 py-2.5 text-[15px] outline-none focus:border-accent";
const boton = "rounded-xl bg-accent px-5 py-2.5 font-bold text-[#0b0f05] transition hover:-translate-y-0.5 disabled:opacity-60";
const botonSec = "rounded-xl border border-line px-4 py-2 text-sm font-semibold transition hover:border-accent hover:text-accent disabled:opacity-60";

function Mensaje({ estado }: { estado: EstadoFormulario }) {
  if (estado.error) return <p className="text-sm font-semibold text-hot">⚠️ {estado.error}</p>;
  if (estado.ok) return <p className="text-sm font-semibold text-ok">{estado.ok}</p>;
  return null;
}

function Etiqueta({ texto, children, ayuda }: { texto: string; children: React.ReactNode; ayuda?: string }) {
  return (
    <label className="block">
      <span className="text-sm text-muted">{texto}</span>
      {children}
      {ayuda && <small className="mt-1 block text-xs text-muted">{ayuda}</small>}
    </label>
  );
}

// ---------------------------------------------------------------------
export function SeccionDatos({ club }: { club: ClubPanel }) {
  const [estado, enviar, enviando] = useActionState(guardarDatos.bind(null, club.id), {});
  return (
    <form action={enviar} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Etiqueta texto="Descripción (la ven los jugadores)">
          <textarea name="descripcion" rows={3} defaultValue={club.descripcion} className={campo}
            placeholder="Canchas de sintético de última generación, vestuarios con agua caliente…" />
        </Etiqueta>
      </div>
      <Etiqueta texto="Dirección"><input name="direccion" defaultValue={club.direccion} className={campo} /></Etiqueta>
      <Etiqueta texto="Barrio / localidad"><input name="barrio" defaultValue={club.barrio} className={campo} /></Etiqueta>
      <Etiqueta texto="WhatsApp del club" ayuda="Con código de país, sin espacios: 5491140000000">
        <input name="whatsapp" defaultValue={club.whatsapp} className={campo} inputMode="tel" />
      </Etiqueta>
      <Etiqueta texto="Horario de atención"><input name="horario" defaultValue={club.horario} className={campo} placeholder="Lun a Dom · 9 a 01 hs" /></Etiqueta>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm text-muted">Servicios</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {SERVICIOS.map((s) => (
            <label key={s} className="cursor-pointer">
              <input type="checkbox" name="servicios" value={s} defaultChecked={club.servicios.includes(s)} className="peer sr-only" />
              <span className="block rounded-lg border border-line bg-bg2 px-3 py-1.5 text-sm transition peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-accent">{s}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={enviando} className={boton}>{enviando ? "Guardando…" : "Guardar datos"}</button>
        <Mensaje estado={estado} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];

export function SeccionFotos({ club }: { club: ClubPanel }) {
  const [estado, setEstado] = useState<EstadoFormulario>({});
  const [subiendo, setSubiendo] = useState(0);
  const [pendiente, iniciar] = useTransition();

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    const supabase = crearClienteNavegador();
    setEstado({});
    for (const archivo of Array.from(archivos)) {
      if (!TIPOS_FOTO.includes(archivo.type)) { setEstado({ error: `"${archivo.name}" no es JPG, PNG o WEBP.` }); continue; }
      if (archivo.size > 5 * 1024 * 1024) { setEstado({ error: `"${archivo.name}" pesa más de 5 MB.` }); continue; }
      setSubiendo((n) => n + 1);
      const ext = archivo.type.split("/")[1].replace("jpeg", "jpg");
      const ruta = `${club.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("club-fotos").upload(ruta, archivo, { contentType: archivo.type });
      if (error) setEstado({ error: `No se pudo subir "${archivo.name}": ${error.message}` });
      else {
        const url = supabase.storage.from("club-fotos").getPublicUrl(ruta).data.publicUrl;
        const r = await registrarFoto(club.id, url);
        if (r.error) setEstado(r);
      }
      setSubiendo((n) => n - 1);
    }
  }

  return (
    <div>
      <label className={`${boton} inline-block cursor-pointer`}>
        {subiendo ? `Subiendo ${subiendo}…` : "+ Subir fotos"}
        <input type="file" accept={TIPOS_FOTO.join(",")} multiple className="sr-only" onChange={(e) => { subir(e.target.files); e.target.value = ""; }} />
      </label>
      <span className="ml-3 text-xs text-muted">JPG, PNG o WEBP · hasta 5 MB cada una</span>
      <div className="mt-2"><Mensaje estado={estado} /></div>
      {club.fotos.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Todavía no subiste fotos. La primera va a ser la portada.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {club.fotos.map((f) => {
            const esPortada = f.url === club.portada;
            return (
              <div key={f.id} className={`group relative overflow-hidden rounded-xl border ${esPortada ? "border-accent" : "border-line"}`}>
                <div className="foto aspect-[4/3]" style={{ backgroundImage: `url('${f.url}')` }} />
                {esPortada && <span className="absolute left-2 top-2 rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-black">Portada</span>}
                <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/70 p-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                  {!esPortada && (
                    <button disabled={pendiente} onClick={() => iniciar(async () => setEstado(await elegirPortada(club.id, f.url)))}
                      className="flex-1 rounded-md bg-white/15 px-2 py-1 text-xs font-semibold">Portada</button>
                  )}
                  <button disabled={pendiente}
                    onClick={() => confirm("¿Borrar esta foto?") && iniciar(async () => setEstado(await borrarFoto(club.id, f.id, f.url)))}
                    className="flex-1 rounded-md bg-hot/80 px-2 py-1 text-xs font-semibold">Borrar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
export function SeccionCanchas({ club }: { club: ClubPanel }) {
  const [estado, enviar, enviando] = useActionState(crearCancha.bind(null, club.id), {});
  return (
    <div className="space-y-4">
      {club.canchas.map((c) => <EditorCancha key={c.id} clubId={club.id} cancha={c} />)}
      <form action={enviar} className="grid gap-3 rounded-2xl border border-dashed border-line p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <Etiqueta texto="Nombre"><input name="nombre" className={campo} placeholder={`Cancha ${club.canchas.length + 1}`} /></Etiqueta>
        <Etiqueta texto="Deporte">
          <select name="deporte" className={campo} defaultValue="FUTBOL">
            {Object.entries(DEPORTES).map(([k, d]) => <option key={k} value={k}>{d.icono} {d.nombre}</option>)}
          </select>
        </Etiqueta>
        <Etiqueta texto="Tipo"><input name="tipo" className={campo} placeholder="F5 sintético, blindex…" /></Etiqueta>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="techada" /> Techada</label>
          <button disabled={enviando} className={boton}>{enviando ? "…" : "+ Agregar"}</button>
        </div>
        <div className="sm:col-span-4"><Mensaje estado={estado} /></div>
      </form>
    </div>
  );
}

const FRANJA_NUEVA: FranjaForm = { dias: [1, 2, 3, 4, 5], desde: "17:00", hasta: "24:00", duracion: 60, precio: 0 };

function EditorCancha({ clubId, cancha }: { clubId: string; cancha: CanchaPanel }) {
  const [franjas, setFranjas] = useState<FranjaForm[]>(cancha.franjas.length ? cancha.franjas : []);
  const [estado, setEstado] = useState<EstadoFormulario>({});
  const [pendiente, iniciar] = useTransition();
  const cambiar = (i: number, p: Partial<FranjaForm>) => setFranjas((fs) => fs.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const icono = DEPORTES[cancha.deporte as keyof typeof DEPORTES]?.icono ?? "🏟️";

  return (
    <div className={`rounded-2xl border p-4 ${cancha.activa ? "border-line bg-bg2/50" : "border-line/50 opacity-60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">
          {icono} {cancha.nombre} <span className="text-sm font-normal text-muted">· {cancha.tipo || "sin tipo"}{cancha.techada ? " · techada" : ""}</span>
        </h3>
        <button disabled={pendiente} className={botonSec}
          onClick={() => iniciar(async () => setEstado(await actualizarCancha(clubId, cancha.id, { activa: !cancha.activa })))}>
          {cancha.activa ? "Desactivar" : "Activar"}
        </button>
      </div>

      <p className="mt-2 text-sm text-muted">Horarios y precios: cada franja genera turnos de la duración elegida.</p>
      <div className="mt-2 space-y-2">
        {franjas.map((f, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-card p-2.5">
            <div>
              <small className="block text-xs text-muted">Días</small>
              <div className="flex gap-1">
                {DIAS.map((d, n) => {
                  const on = f.dias.includes(n);
                  return (
                    <button key={n} type="button" aria-pressed={on}
                      onClick={() => cambiar(i, { dias: on ? f.dias.filter((x) => x !== n) : [...f.dias, n].sort() })}
                      className={`size-8 rounded-lg text-xs font-bold transition ${on ? "bg-accent text-black" : "bg-bg2 text-muted"}`}>{d}</button>
                  );
                })}
              </div>
            </div>
            <Selector etiqueta="Desde" valor={f.desde} opciones={HORAS.slice(0, -1)} onChange={(v) => cambiar(i, { desde: v })} />
            <Selector etiqueta="Hasta" valor={f.hasta} opciones={HORAS.slice(1)} onChange={(v) => cambiar(i, { hasta: v })} />
            <Selector etiqueta="Turno" valor={String(f.duracion)} opciones={["30", "60", "90", "120"]} sufijo=" min" onChange={(v) => cambiar(i, { duracion: Number(v) })} />
            <label>
              <small className="block text-xs text-muted">Precio $</small>
              <input type="number" min={0} step={500} value={f.precio || ""} onChange={(e) => cambiar(i, { precio: Number(e.target.value) })}
                className="w-28 rounded-lg border border-line bg-bg2 px-2 py-1.5 text-sm" />
            </label>
            <button type="button" aria-label="Quitar franja" onClick={() => setFranjas((fs) => fs.filter((_, j) => j !== i))}
              className="ml-auto rounded-lg px-2 py-1.5 text-muted hover:text-hot">✕</button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={botonSec} onClick={() => setFranjas((fs) => [...fs, { ...FRANJA_NUEVA }])}>+ Franja horaria</button>
        <button type="button" disabled={pendiente} className={boton}
          onClick={() => iniciar(async () => {
            if (franjas.some((f) => !f.precio)) return setEstado({ error: "Poné el precio de cada franja." });
            setEstado(await guardarHorarios(clubId, cancha.id, franjas));
          })}>
          {pendiente ? "Guardando…" : "Guardar horarios"}
        </button>
        <Mensaje estado={estado} />
      </div>
    </div>
  );
}

function Selector(p: { etiqueta: string; valor: string; opciones: string[]; sufijo?: string; onChange: (v: string) => void }) {
  return (
    <label>
      <small className="block text-xs text-muted">{p.etiqueta}</small>
      <select value={p.valor} onChange={(e) => p.onChange(e.target.value)} className="rounded-lg border border-line bg-bg2 px-2 py-1.5 text-sm">
        {p.opciones.map((o) => <option key={o} value={o}>{o}{p.sufijo ?? ""}</option>)}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------
export function SeccionReglas({ club }: { club: ClubPanel }) {
  const [estado, enviar, enviando] = useActionState(guardarReglas.bind(null, club.id), {});
  const r = club.reglas;
  return (
    <form action={enviar} className="grid gap-4 sm:grid-cols-2">
      <Etiqueta texto="Seña mínima (% del precio)" ayuda="Lo que el grupo tiene que juntar para confirmar el turno.">
        <input name="sena" type="number" min={0} max={100} defaultValue={r.senaPct} className={campo} />
      </Etiqueta>
      <Etiqueta texto="Plazo para pagar la seña (horas)" ayuda="Desde que reservan. Por defecto 72 h (3 días).">
        <input name="plazoPago" type="number" min={1} defaultValue={r.plazoPagoHoras} className={campo} />
      </Etiqueta>
      <Etiqueta texto="Corte antes del partido (días)" ayuda="Toda reserva tiene que estar confirmada hasta este tiempo antes del partido. Después, los turnos libres pasan a Último momento.">
        <input name="corteDias" type="number" min={0.5} step={0.5} defaultValue={r.corteHoras / 24} className={campo} />
      </Etiqueta>
      <Etiqueta texto="Último momento: descuento (%)" ayuda="Se aplica a los turnos libres dentro del corte.">
        <input name="descuento" type="number" min={0} max={100} defaultValue={r.descuentoUmPct} className={campo} />
      </Etiqueta>
      <Etiqueta texto="Último momento: plazo para pagar la seña (horas)" ayuda="Desde que reservan (o hasta que empieza el partido, si es antes).">
        <input name="plazoUm" type="number" min={1} defaultValue={r.plazoUmHoras} className={campo} />
      </Etiqueta>
      <label className="flex items-center gap-2 self-center text-sm">
        <input type="checkbox" name="desafios" defaultChecked={r.permiteDesafios} className="size-4" />
        Permitir desafíos (equipos que buscan rival)
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={enviando} className={boton}>{enviando ? "Guardando…" : "Guardar reglas"}</button>
        <Mensaje estado={estado} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
export function SeccionCobros({ club }: { club: ClubPanel }) {
  const [estado, enviar, enviando] = useActionState(guardarCobros.bind(null, club.id), {});
  const c = club.cobros;
  return (
    <form action={enviar} className="space-y-4">
      <div className="rounded-2xl border border-line bg-bg2/50 p-4 opacity-70">
        <b>💳 Mercado Pago</b> <span className="ml-2 rounded-md bg-violet/20 px-2 py-0.5 text-xs font-bold text-violet">Próximamente</span>
        <p className="mt-1 text-sm text-muted">Vas a poder conectar tu cuenta para que los pagos se acrediten y confirmen solos.</p>
      </div>
      <div className="rounded-2xl border border-line bg-bg2/50 p-4">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" name="transferencia" defaultChecked={c.transferencia} className="size-4" /> 🏦 Transferencia bancaria
        </label>
        <p className="mt-1 text-sm text-muted">Los jugadores transfieren y suben el comprobante; vos lo aprobás desde el panel.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Etiqueta texto="Titular de la cuenta *"><input name="titular" defaultValue={c.titular} className={campo} /></Etiqueta>
          <Etiqueta texto="Alias"><input name="alias" defaultValue={c.alias} className={campo} placeholder="mi.club.alias" /></Etiqueta>
          <Etiqueta texto="CBU / CVU"><input name="cbu" defaultValue={c.cbu} className={campo} inputMode="numeric" /></Etiqueta>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={enviando} className={boton}>{enviando ? "Guardando…" : "Guardar cobros"}</button>
        <Mensaje estado={estado} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
export function BotonPublicar({ clubId, listo }: { clubId: string; listo: boolean }) {
  const [estado, setEstado] = useState<EstadoFormulario>({});
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button disabled={!listo || pendiente} onClick={() => iniciar(async () => setEstado(await publicarClub(clubId)))}
        className={`${boton} px-6 py-3 text-base`} title={listo ? undefined : "Completá los pasos marcados"}>
        {pendiente ? "Publicando…" : "🚀 Publicar mi club"}
      </button>
      <Mensaje estado={estado} />
    </div>
  );
}
