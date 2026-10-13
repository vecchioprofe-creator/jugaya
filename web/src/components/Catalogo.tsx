"use client";

import { useState } from "react";
import { DEPORTES } from "@/lib/deportes";
import type { Club, Deporte } from "@/lib/tipos";
import { TarjetaClub } from "./TarjetaClub";

export function Catalogo({ clubes }: { clubes: Club[] }) {
  const [deporte, setDeporte] = useState<Deporte | null>(null);
  const lista = deporte ? clubes.filter((c) => c.deportes.includes(deporte)) : clubes;
  const categorias: (Deporte | null)[] = [null, ...(Object.keys(DEPORTES) as Deporte[])];

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {categorias.map((d) => {
          const activo = d === deporte;
          const cantidad = d ? clubes.filter((c) => c.deportes.includes(d)).length : clubes.length;
          return (
            <button
              key={d ?? "todos"}
              onClick={() => setDeporte(d)}
              className={`group relative min-w-36 shrink-0 overflow-hidden rounded-[20px] border p-4 text-left transition ${
                activo ? "border-accent bg-gradient-to-b from-accent/15 to-card" : "border-line bg-card hover:border-muted"
              }`}
            >
              <span className="block text-4xl transition duration-300 group-hover:-rotate-12 group-hover:scale-125">
                {d ? DEPORTES[d].icono : "🏟️"}
              </span>
              <b className="mt-2 block">{d ? DEPORTES[d].nombre : "Todos"}</b>
              <small className="text-muted">{cantidad} lugares</small>
              {activo && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-accent" />}
            </button>
          );
        })}
      </div>
      <p className="mb-4 mt-2 text-sm text-muted">{lista.length} resultados</p>
      {/* key fuerza a re-animar las tarjetas al cambiar de categoría */}
      <div key={deporte ?? "todos"} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((c, i) => (
          <TarjetaClub key={c.id} club={c} indice={i} />
        ))}
      </div>
    </>
  );
}
