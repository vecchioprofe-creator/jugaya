"use client";

import { useState, useTransition } from "react";
import { plata } from "@/lib/reglas";
import { cobrarEnClub, revisarPago, type Resultado } from "./acciones";

function Aviso({ r }: { r: Resultado }) {
  if (r.error) return <span className="text-xs font-semibold text-hot">⚠️ {r.error}</span>;
  if (r.ok) return <span className="text-xs font-semibold text-ok">{r.ok}</span>;
  return null;
}

export function RevisarComprobante({ clubId, pagoId }: { clubId: string; pagoId: string }) {
  const [r, setR] = useState<Resultado>({});
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button disabled={pendiente} onClick={() => iniciar(async () => setR(await revisarPago(clubId, pagoId, true)))}
        className="rounded-lg bg-ok px-3 py-1.5 text-sm font-bold text-black disabled:opacity-50">✔ Aprobar</button>
      <button disabled={pendiente}
        onClick={() => {
          const motivo = prompt("¿Por qué lo rechazás? (lo va a ver el jugador)", "No se ve el monto o la fecha");
          if (motivo !== null) iniciar(async () => setR(await revisarPago(clubId, pagoId, false, motivo)));
        }}
        className="rounded-lg border border-hot/60 px-3 py-1.5 text-sm font-bold text-hot disabled:opacity-50">✕ Rechazar</button>
      <Aviso r={r} />
    </div>
  );
}

export function CobroEnClub({ clubId, reservaId, falta }: { clubId: string; reservaId: string; falta: number }) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState(String(Math.round(falta)));
  const [r, setR] = useState<Resultado>({});
  const [pendiente, iniciar] = useTransition();
  if (falta <= 0) return null;
  if (!abierto) return (
    <button onClick={() => setAbierto(true)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:border-accent">
      💵 Registrar cobro en el club
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="number" min={1} max={falta} value={monto} onChange={(e) => setMonto(e.target.value)}
        className="w-28 rounded-lg border border-line bg-bg2 px-2 py-1.5 text-sm" />
      <button disabled={pendiente} onClick={() => iniciar(async () => setR(await cobrarEnClub(clubId, reservaId, Number(monto))))}
        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50">Registrar</button>
      <span className="text-xs text-muted">Falta {plata(falta)}</span>
      <Aviso r={r} />
    </div>
  );
}
