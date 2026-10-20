"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reservar } from "@/app/club/[slug]/acciones";
import { calcularVencimiento, fechaHora, horasTexto, instanteAR, plata, senaMinima, ZONA } from "@/lib/reglas";
import { supabaseConfigurado } from "@/lib/supabase/config";
import type { Club, Deporte, Turno } from "@/lib/tipos";
import { BotonIngresar } from "./BotonIngresar";

/** Datos del jugador conectado (null = sin sesión). */
export type JugadorConectado = { nombre: string; whatsapp: string } | null;

type Props = {
  club: Club;
  dias: string[];
  diaInicial: string;
  turnosPorDia: Record<string, Turno[]>;
  jugador: JugadorConectado;
};

const ESTILO: Record<Turno["estado"], string> = {
  LIBRE: "border-ok/30 bg-ok/10 text-ok hover:scale-105 hover:bg-ok hover:text-black cursor-pointer",
  ULTIMO_MOMENTO: "border-hot/40 bg-hot/10 text-hot hover:scale-105 hover:bg-hot hover:text-white cursor-pointer",
  EN_PROCESO: "rayado border-warn/35 text-warn cursor-help",
  BUSCA_RIVAL: "border-accent2/40 bg-accent2/10 text-accent2 cursor-help",
  RESERVADO: "border-transparent bg-bg2 text-[#4b5563] line-through cursor-not-allowed",
  PASADO: "border-transparent bg-bg2/50 text-[#374151] cursor-not-allowed",
};

function etiqueta(t: Turno) {
  switch (t.estado) {
    case "LIBRE": return plata(t.precio);
    case "ULTIMO_MOMENTO": return `🔥 ${plata(t.precio)}`;
    case "EN_PROCESO": return `⏳ ${t.quedaTexto}`;
    case "BUSCA_RIVAL": return "⚔️ Rival";
    case "RESERVADO": return "Reservado";
    case "PASADO": return "—";
  }
}

function ayuda(t: Turno) {
  if (t.estado === "EN_PROCESO") return `Alguien está reservando. Si no completan la seña en ${t.quedaTexto}, vuelve a estar libre.`;
  if (t.estado === "BUSCA_RIVAL") return "Un equipo busca rival para este turno. Mirá la solicitud en Solicitudes.";
  return undefined;
}

export function GrillaTurnos({ club, dias, diaInicial, turnosPorDia, jugador }: Props) {
  const [dia, setDia] = useState(diaInicial);
  const [elegido, setElegido] = useState<Turno | null>(null);
  const turnos = turnosPorDia[dia] ?? [];
  const horas = [...new Set(turnos.map((t) => t.hora))].sort();
  const celda = (canchaId: string, hora: string) => turnos.find((t) => t.canchaId === canchaId && t.hora === hora);

  return (
    <section className="rounded-[18px] border border-line bg-card p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-4xl tracking-wide">
          Turnos <span className="text-accent">disponibles</span>
        </h2>
        <span className="text-sm text-muted">Tocá un turno verde o 🔥 para reservar</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1.5">
        {dias.map((d, i) => {
          const f = instanteAR(d, "12:00");
          const activo = d === dia;
          return (
            <button
              key={d}
              onClick={() => setDia(d)}
              className={`min-w-16 shrink-0 rounded-2xl border px-3 py-2 text-center transition ${
                activo ? "border-accent bg-accent text-black" : "border-line bg-bg2 hover:border-muted"
              }`}
            >
              <small className="block capitalize">
                {i === 0 ? "Hoy" : f.toLocaleDateString("es-AR", { timeZone: ZONA, weekday: "short" })}
              </small>
              <b className="block text-xl">{f.toLocaleDateString("es-AR", { timeZone: ZONA, day: "numeric" })}</b>
              <small className="capitalize">{f.toLocaleDateString("es-AR", { timeZone: ZONA, month: "short" })}</small>
            </button>
          );
        })}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-1.5 text-xs">
          <thead>
            <tr>
              <th />
              {club.canchas.map((c) => (
                <th key={c.id} className="px-1 text-left text-[13px] font-semibold text-muted">
                  {c.nombre} <span className="font-normal">· {c.tipo}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={dia} className="aparecer">
            {horas.map((h) => (
              <tr key={h}>
                <th className="pr-1 text-left text-[13px] font-semibold text-muted">{h}</th>
                {club.canchas.map((c) => {
                  const t = celda(c.id, h);
                  if (!t) return <td key={c.id} />;
                  const reservable = t.estado === "LIBRE" || t.estado === "ULTIMO_MOMENTO";
                  return (
                    <td key={c.id}>
                      <button
                        disabled={!reservable && !ayuda(t)}
                        title={ayuda(t)}
                        onClick={() => reservable && setElegido(t)}
                        className={`w-full rounded-[10px] border px-2 py-2.5 text-center font-bold transition ${ESTILO[t.estado]}`}
                      >
                        {etiqueta(t)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
        <Leyenda color="bg-ok" texto="Libre" />
        <Leyenda color="bg-hot" texto={`Último momento (-${club.reglas.descuentoUmPct}%)`} />
        <Leyenda color="bg-warn" texto="En proceso de reserva" />
        <Leyenda color="bg-accent2" texto="Buscan rival" />
        <Leyenda color="bg-[#374151]" texto="Reservado" />
      </div>

      {elegido && <ModalReserva club={club} turno={elegido} jugador={jugador} onCerrar={() => setElegido(null)} />}
    </section>
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={`inline-block size-3.5 rounded ${color}`} />
      {texto}
    </span>
  );
}

const JUGADORES_SUGERIDOS: Record<Deporte, number> = { FUTBOL: 10, PADEL: 4, TENIS: 2, BASQUET: 10, VOLEY: 12 };

function ModalReserva({ club, turno, jugador, onCerrar }: { club: Club; turno: Turno; jugador: JugadorConectado; onCerrar: () => void }) {
  const ultimoMomento = turno.estado === "ULTIMO_MOMENTO";
  const r = club.reglas;
  const inicio = new Date(turno.inicio);
  const vence = calcularVencimiento(r, ultimoMomento ? "ULTIMO_MOMENTO" : "NORMAL", inicio);
  const sena = senaMinima(r, turno.precio);
  const cancha = club.canchas.find((c) => c.id === turno.canchaId);
  const sugeridos = JUGADORES_SUGERIDOS[cancha?.deporte ?? "FUTBOL"];

  const router = useRouter();
  const [nombres, setNombres] = useState<string[]>(() => [jugador?.nombre ?? "", ...Array(sugeridos - 1).fill("")]);
  const [whatsapp, setWhatsapp] = useState(jugador?.whatsapp ?? "");
  const [acepto, setAcepto] = useState(false);
  const [error, setError] = useState("");
  const [pendiente, iniciar] = useTransition();

  const cantidad = (n: number) =>
    setNombres((ns) => (n > ns.length ? [...ns, ...Array(n - ns.length).fill("")] : ns.slice(0, Math.max(2, n))));

  function confirmar() {
    setError("");
    iniciar(async () => {
      const res = await reservar({ canchaId: turno.canchaId, inicio: turno.inicio, jugadores: nombres, whatsapp });
      if (res.error) setError(res.error);
      else router.push(`/g/${res.codigo}?nuevo=1`);
    });
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        className="aparecer relative max-h-[90vh] w-full max-w-lg overflow-y-auto overflow-x-hidden rounded-3xl border border-line bg-bg2 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onCerrar} aria-label="Cerrar" className="absolute right-4 top-4 size-9 rounded-lg bg-card text-lg">✕</button>
        <h2 className="font-display text-4xl tracking-wide">Reservar {turno.hora} hs</h2>
        <p className="text-sm capitalize text-muted">
          {club.nombre} · {cancha?.nombre} ({cancha?.tipo}) · {fechaHora(inicio)}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-card p-3 text-center text-sm">
          <div>
            <small className="block text-muted">Precio</small>
            {turno.descuentoPct > 0 && <s className="mr-1 text-xs text-muted">{plata(turno.precioLista)}</s>}
            <b>{plata(turno.precio)}</b>
          </div>
          <div>
            <small className="block text-muted">Seña mínima ({r.senaPct}%)</small>
            <b className="text-accent">{plata(sena)}</b>
          </div>
          <div>
            <small className="block text-muted">Pagala antes de</small>
            <b className="capitalize text-warn">{fechaHora(vence)}</b>
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-line bg-card p-3 text-sm">
          {ultimoMomento ? (
            <>🔥 <b>Último momento:</b> {r.descuentoUmPct}% de descuento. La seña se paga dentro de las {horasTexto(r.plazoUmHoras)} de reservar.</>
          ) : (
            <>👥 El grupo tiene {horasTexto(r.plazoPagoHoras)} para juntar la seña (siempre hasta {horasTexto(r.corteHoras)} antes del partido). Cada uno paga su parte desde el link del grupo.</>
          )}
        </p>

        {!jugador ? (
          <div className="mt-5 flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-muted">Para reservar ingresá con tu cuenta de Google.</p>
            <BotonIngresar habilitado={supabaseConfigurado} />
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-center justify-between gap-3">
              <h3 className="font-semibold">¿Cuántos van a jugar?</h3>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => cantidad(nombres.length - 1)} className="size-9 rounded-lg border border-line bg-card text-lg">−</button>
                <b className="w-8 text-center font-display text-3xl">{nombres.length}</b>
                <button type="button" onClick={() => cantidad(Math.min(30, nombres.length + 1))} className="size-9 rounded-lg border border-line bg-card text-lg">+</button>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">≈ {plata(sena / nombres.length)} de seña por persona. Los nombres se pueden cambiar después.</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {nombres.map((n, i) => (
                <input key={i} value={n} maxLength={40} placeholder={i === 0 ? "Vos" : `Jugador ${i + 1}`}
                  onChange={(e) => setNombres((ns) => ns.map((x, j) => (j === i ? e.target.value : x)))}
                  className="rounded-lg border border-line bg-card px-2.5 py-2 text-sm outline-none focus:border-accent" />
              ))}
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-semibold">Tu WhatsApp</span>
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="11 4000 0000"
                className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-accent" />
              <small className="text-xs text-muted">Para que el club y tu grupo te puedan contactar.</small>
            </label>
            <label className="mt-4 flex items-start gap-2 text-xs text-muted">
              <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-0.5" />
              Acepto que si no se completa la seña antes del <b className="capitalize text-text">{fechaHora(vence)}</b>, el turno se libera y el club retiene lo abonado.
            </label>
            {error && <p className="mt-3 text-sm font-semibold text-hot">⚠️ {error}</p>}
            <button onClick={confirmar} disabled={!acepto || pendiente}
              className="mt-4 w-full rounded-xl bg-accent px-5 py-3 font-bold text-[#0b0f05] transition hover:-translate-y-0.5 disabled:opacity-50">
              {pendiente ? "Reservando…" : "Crear grupo y bloquear el turno 🔒"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
