"use client";

import { useState } from "react";
import { calcularVencimiento, fechaHora, horasTexto, instanteAR, plata, senaMinima, ZONA } from "@/lib/reglas";
import type { Club, TipoReserva, Turno } from "@/lib/tipos";

type Props = {
  club: Club;
  dias: string[];
  diaInicial: string;
  turnosPorDia: Record<string, Turno[]>;
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

export function GrillaTurnos({ club, dias, diaInicial, turnosPorDia }: Props) {
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

      {elegido && <ModalReserva club={club} turno={elegido} onCerrar={() => setElegido(null)} />}
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

function ModalReserva({ club, turno, onCerrar }: { club: Club; turno: Turno; onCerrar: () => void }) {
  const ultimoMomento = turno.estado === "ULTIMO_MOMENTO";
  const [modo, setModo] = useState<TipoReserva>(ultimoMomento ? "ULTIMO_MOMENTO" : "NORMAL");
  const r = club.reglas;
  const inicio = new Date(turno.inicio);
  const vence = calcularVencimiento(r, modo, inicio);
  const sena = senaMinima(r, turno.precio);
  const cancha = club.canchas.find((c) => c.id === turno.canchaId);

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
            {modo === "DESAFIO" && <small className="block text-muted">{plata(sena / 2)} por equipo</small>}
          </div>
          <div>
            <small className="block text-muted">Pagala antes de</small>
            <b className="capitalize text-warn">{fechaHora(vence)}</b>
          </div>
        </div>

        {!ultimoMomento && (
          <div className="mt-4 grid gap-2.5">
            <Opcion activa={modo === "NORMAL"} onClick={() => setModo("NORMAL")} icono="👥"
              titulo="Partido entre amigos" detalle={`Tienen ${horasTexto(r.plazoPagoHoras)} para juntar la seña (siempre hasta ${horasTexto(r.corteHoras)} antes del partido).`} />
            {r.permiteDesafios && (
              <Opcion activa={modo === "DESAFIO"} onClick={() => setModo("DESAFIO")} icono="⚔️"
                titulo="Buscar equipo rival" detalle={`Se publica en Solicitudes. Cada equipo paga la mitad de la seña hasta ${horasTexto(r.corteHoras)} antes del partido.`} />
            )}
          </div>
        )}
        {ultimoMomento && (
          <p className="mt-4 rounded-xl border border-hot/40 bg-hot/10 p-3 text-sm">
            🔥 <b>Último momento:</b> {r.descuentoUmPct}% de descuento. La seña se paga dentro de las {horasTexto(r.plazoUmHoras)} de reservar.
          </p>
        )}

        <p className="mt-4 text-xs text-muted">
          {modo === "DESAFIO"
            ? "Si algún equipo no completa su mitad a tiempo, el turno se libera y se devuelve lo pagado."
            : "Si no se completa la seña a tiempo, el turno se libera y el club retiene lo abonado."}
        </p>
        <button disabled className="mt-4 w-full rounded-xl bg-accent px-5 py-3 font-bold text-[#0b0f05] opacity-60">
          Ingresá con Google para reservar (próximamente)
        </button>
      </div>
    </div>
  );
}

function Opcion(p: { activa: boolean; onClick: () => void; icono: string; titulo: string; detalle: string }) {
  return (
    <button
      onClick={p.onClick}
      className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${p.activa ? "border-accent bg-accent/10" : "border-line bg-card"}`}
    >
      <span className="text-2xl">{p.icono}</span>
      <span>
        <b>{p.titulo}</b>
        <small className="block text-muted">{p.detalle}</small>
      </span>
    </button>
  );
}
