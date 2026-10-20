"use client";

import { useEffect, useState, useTransition } from "react";
import { plata } from "@/lib/reglas";
import { crearClienteNavegador } from "@/lib/supabase/navegador";
import { agregarJugador, eliminarJugador, informarTransferencia, renombrarJugador, type Resultado } from "./acciones";

export type JugadorG = { id: string; nombre: string; acreditado: number; enRevision: number };
export type EquipoG = { id: string; nombre: string | null; senaMinima: number; precioEquipo: number; jugadores: JugadorG[]; esAdmin: boolean };
export type DatosPago = {
  bookingId: string; codigo: string; abierto: boolean;
  aceptaTransferencia: boolean; alias: string; cbu: string; titular: string;
  falta: number; // lo que falta del total (descontando lo aprobado y lo que está en revisión)
};

const COLORES = ["#c6ff3d", "#22d3ee", "#ffb020", "#ff4d6d", "#8b5cf6", "#2ee59d", "#f472b6"];

function Aviso({ r }: { r: Resultado }) {
  if (r.error) return <p className="text-sm font-semibold text-hot">⚠️ {r.error}</p>;
  if (r.ok) return <p className="text-sm font-semibold text-ok">✔ {r.ok}</p>;
  return null;
}

// ---------------------------------------------------------------------
export function CuentaRegresiva({ hasta }: { hasta: string }) {
  const [resta, setResta] = useState<number | null>(null); // null hasta montar (evita diferencias servidor/navegador)
  useEffect(() => {
    const calcular = () => setResta(Math.max(0, new Date(hasta).getTime() - Date.now()));
    calcular();
    const t = setInterval(calcular, 1000);
    return () => clearInterval(t);
  }, [hasta]);
  if (resta === null) return <div className="h-[74px]" />;
  const partes = [
    [Math.floor(resta / 86_400_000), "días"],
    [Math.floor(resta / 3_600_000) % 24, "horas"],
    [Math.floor(resta / 60_000) % 60, "min"],
    [Math.floor(resta / 1000) % 60, "seg"],
  ] as const;
  return (
    <div className="flex justify-center gap-2.5">
      {partes.map(([n, t]) => (
        <div key={t} className="min-w-16 rounded-2xl border border-line bg-bg2 px-3 py-2">
          <b className="block font-display text-4xl leading-none text-warn">{String(n).padStart(2, "0")}</b>
          <small className="text-[11px] uppercase tracking-wider text-muted">{t}</small>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
export function Compartir({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = () => window.location.href.split("?")[0]; // se lee al tocar (no durante el render)
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${texto}\n${url()}`)}`, "_blank", "noopener")}
        className="rounded-xl bg-[#25d366] px-4 py-2.5 text-sm font-bold text-[#04210f]">Compartir por WhatsApp</button>
      <button onClick={async () => { await navigator.clipboard.writeText(url()); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
        className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:border-accent hover:text-accent">
        {copiado ? "✔ Link copiado" : "📋 Copiar link"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
export function ListaEquipo({ equipo, pago }: { equipo: EquipoG; pago: DatosPago }) {
  const [pagando, setPagando] = useState<JugadorG | null>(null);
  const [aviso, setAviso] = useState<Resultado>({});
  const [nuevo, setNuevo] = useState("");
  const [pendiente, iniciar] = useTransition();
  const n = equipo.jugadores.length;
  const pagado = equipo.jugadores.reduce((a, j) => a + j.acreditado, 0);
  const porJugador = equipo.senaMinima / n;

  const eliminar = (j: JugadorG) => {
    const resto = n - 1;
    const msg = j.acreditado > 0
      ? `¿Eliminar a ${j.nombre}? Ya pagó ${plata(j.acreditado)}: se reparte en partes iguales entre los ${resto} que quedan (+${plata(j.acreditado / resto)} c/u).`
      : `¿Eliminar a ${j.nombre} de la lista?`;
    if (confirm(msg)) iniciar(async () => setAviso(await eliminarJugador(pago.codigo, j.id)));
  };
  const renombrar = (j: JugadorG) => {
    const nombre = prompt(`Nuevo nombre o apodo${j.acreditado ? ` (los ${plata(j.acreditado)} pagados quedan para la nueva persona)` : ""}:`, j.nombre);
    if (nombre) iniciar(async () => setAviso(await renombrarJugador(pago.codigo, j.id, nombre)));
  };

  return (
    <div className="rounded-[22px] border border-line border-t-4 border-t-accent bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl">{equipo.nombre ?? "Jugadores"} <span className="text-lg text-muted">({n})</span></h2>
        <span className={`text-sm font-bold ${pagado >= equipo.senaMinima ? "text-ok" : "text-warn"}`}>{plata(pagado)} acreditado</span>
      </div>

      <ul className="mt-3 space-y-2">
        {equipo.jugadores.map((j, i) => (
          <li key={j.id} className="aparecer flex items-center gap-2.5 rounded-xl border border-line bg-bg2 p-2.5" style={{ animationDelay: `${i * 40}ms` }}>
            <span className="grid size-9 shrink-0 place-items-center rounded-full font-extrabold text-black" style={{ background: COLORES[i % COLORES.length] }}>
              {j.nombre[0]?.toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate">{j.nombre}</b>
              <small className="text-muted">
                {j.acreditado >= porJugador ? "✅ Cubrió su parte de la seña" : `Su parte de la seña: ${plata(porJugador)}`}
                {j.enRevision > 0 && <span className="text-warn"> · ⏳ {plata(j.enRevision)} en revisión</span>}
              </small>
            </span>
            <b className={`text-sm ${j.acreditado ? "text-ok" : "text-muted"}`}>{plata(j.acreditado)}</b>
            {pago.abierto && pago.aceptaTransferencia && (
              <button onClick={() => setPagando(j)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-black">Pagar</button>
            )}
            {equipo.esAdmin && (
              <span className="flex">
                <button disabled={pendiente} onClick={() => renombrar(j)} title="Renombrar" className="p-1 text-muted hover:text-text">✏️</button>
                {n > 2 && <button disabled={pendiente} onClick={() => eliminar(j)} title="Eliminar" className="p-1 text-muted hover:text-hot">🗑️</button>}
              </span>
            )}
          </li>
        ))}
      </ul>

      {equipo.esAdmin && (
        <form className="mt-3 flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () => { const r = await agregarJugador(pago.codigo, equipo.id, nuevo); setAviso(r); if (r.ok) setNuevo(""); });
        }}>
          <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} maxLength={40} placeholder="Agregar jugador (nombre o apodo)"
            className="flex-1 rounded-xl border border-line bg-bg2 px-3 py-2 text-sm outline-none focus:border-accent" />
          <button disabled={pendiente || !nuevo.trim()} className="rounded-xl border border-line px-4 text-sm font-semibold hover:border-accent disabled:opacity-50">+ Agregar</button>
        </form>
      )}
      <div className="mt-2"><Aviso r={aviso} /></div>

      {pagando && <ModalPago jugador={pagando} equipo={equipo} pago={pago} onCerrar={() => setPagando(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------
const TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function ModalPago({ jugador, equipo, pago, onCerrar }: { jugador: JugadorG; equipo: EquipoG; pago: DatosPago; onCerrar: () => void }) {
  const n = equipo.jugadores.length;
  const ya = jugador.acreditado + jugador.enRevision;
  const pagadoEquipo = equipo.jugadores.reduce((a, j) => a + j.acreditado + j.enRevision, 0);
  const tope = (x: number) => Math.min(Math.max(0, Math.ceil(x)), pago.falta);
  const opciones = [
    { id: "sena", titulo: "Mi parte de la seña", detalle: "Asegura el turno", monto: tope(equipo.senaMinima / n - ya) },
    { id: "total", titulo: "Mi parte del total", detalle: "Y te olvidás", monto: tope(equipo.precioEquipo / n - ya) },
    { id: "falta", titulo: "Todo lo que falta de la seña", detalle: "Bancás al grupo", monto: tope(equipo.senaMinima - pagadoEquipo) },
  ].filter((o) => o.monto > 0);

  const [elegida, setElegida] = useState(opciones[0]?.id ?? "otro");
  const [otro, setOtro] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [res, setRes] = useState<Resultado>({});
  const [pendiente, iniciar] = useTransition();
  const monto = elegida === "otro" ? Math.ceil(Number(otro) || 0) : opciones.find((o) => o.id === elegida)?.monto ?? 0;

  function enviar() {
    setRes({});
    if (monto <= 0) return setRes({ error: "Elegí o escribí el monto que transferiste." });
    if (monto > pago.falta) return setRes({ error: `El máximo que falta pagar es ${plata(pago.falta)}.` });
    if (!archivo) return setRes({ error: "Adjuntá el comprobante de la transferencia." });
    if (!TIPOS.includes(archivo.type)) return setRes({ error: "El comprobante tiene que ser una imagen (JPG, PNG, WEBP) o un PDF." });
    if (archivo.size > 5 * 1024 * 1024) return setRes({ error: "El comprobante pesa más de 5 MB." });
    iniciar(async () => {
      const ext = archivo.type === "application/pdf" ? "pdf" : archivo.type.split("/")[1].replace("jpeg", "jpg");
      const ruta = `${pago.bookingId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await crearClienteNavegador().storage.from("comprobantes").upload(ruta, archivo, { contentType: archivo.type });
      if (error) return setRes({ error: `No se pudo subir el comprobante: ${error.message}` });
      setRes(await informarTransferencia(pago.codigo, jugador.id, monto, ruta));
    });
  }

  const copiar = (t: string) => navigator.clipboard.writeText(t);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onCerrar}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className="aparecer relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-bg2 p-6">
        <button onClick={onCerrar} aria-label="Cerrar" className="absolute right-4 top-4 size-9 rounded-lg bg-card text-lg">✕</button>
        <h2 className="font-display text-4xl tracking-wide">Pagar · {jugador.nombre}</h2>

        {res.ok ? (
          <div className="mt-5 space-y-4 text-center">
            <p className="text-5xl">🎉</p>
            <p className="font-semibold text-ok">{res.ok}</p>
            <button onClick={onCerrar} className="w-full rounded-xl bg-accent py-3 font-bold text-black">Volver al grupo</button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">1) Elegí cuánto vas a pagar · 2) Transferí · 3) Subí el comprobante</p>
            <div className="mt-4 grid gap-2">
              {opciones.map((o) => (
                <button key={o.id} onClick={() => setElegida(o.id)}
                  className={`flex items-center justify-between rounded-2xl border p-3 text-left ${elegida === o.id ? "border-accent bg-accent/10" : "border-line bg-card"}`}>
                  <span><b>{o.titulo}</b><small className="block text-muted">{o.detalle}</small></span>
                  <b>{plata(o.monto)}</b>
                </button>
              ))}
              <label className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${elegida === "otro" ? "border-accent bg-accent/10" : "border-line bg-card"}`}>
                <span onClick={() => setElegida("otro")}><b>Otro monto</b></span>
                <input type="number" min={1} step={100} value={otro} onFocus={() => setElegida("otro")} onChange={(e) => setOtro(e.target.value)}
                  placeholder="$" className="w-28 rounded-lg border border-line bg-bg2 px-2 py-1.5 text-right text-sm" />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-line bg-card p-3 text-sm">
              <p className="mb-2 font-semibold">🏦 Transferí {monto > 0 ? <b className="text-accent">{plata(monto)}</b> : "el monto"} a:</p>
              <Dato etiqueta="Titular" valor={pago.titular} />
              {pago.alias && <Dato etiqueta="Alias" valor={pago.alias} copiar={copiar} />}
              {pago.cbu && <Dato etiqueta="CBU/CVU" valor={pago.cbu} copiar={copiar} />}
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-semibold">Comprobante de la transferencia</span>
              <input type="file" accept={TIPOS.join(",")} onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-card file:px-3 file:py-2 file:font-semibold file:text-text" />
            </label>

            <div className="mt-3"><Aviso r={res} /></div>
            <button onClick={enviar} disabled={pendiente}
              className="mt-4 w-full rounded-xl bg-accent py-3 font-bold text-black transition hover:-translate-y-0.5 disabled:opacity-60">
              {pendiente ? "Enviando…" : "Ya transferí · Enviar comprobante"}
            </button>
            <p className="mt-2 text-center text-xs text-muted">El club revisa el comprobante y el pago se suma al total del grupo.</p>
          </>
        )}
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor, copiar }: { etiqueta: string; valor: string; copiar?: (t: string) => void }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 border-t border-line py-1.5 first:border-t-0">
      <span className="text-muted">{etiqueta}</span>
      <span className="flex items-center gap-2 font-semibold">
        {valor}
        {copiar && (
          <button onClick={() => { copiar(valor); setOk(true); setTimeout(() => setOk(false), 1500); }}
            className="rounded-md bg-bg2 px-2 py-0.5 text-xs">{ok ? "✔" : "Copiar"}</button>
        )}
      </span>
    </div>
  );
}
