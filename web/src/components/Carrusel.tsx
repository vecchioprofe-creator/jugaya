"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fondo } from "@/lib/deportes";
import type { Publicidad } from "@/lib/tipos";

export function Carrusel({ items }: { items: Publicidad[] }) {
  const [actual, setActual] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActual((i) => (i + 1) % items.length), 5500);
    return () => clearInterval(t);
  }, [items.length]);

  return (
    <section className="relative h-[480px] overflow-hidden rounded-b-[34px] sm:h-[520px]" aria-roledescription="carrusel">
      {items.map((p, i) => (
        <div
          key={p.id}
          aria-hidden={i !== actual}
          className={`foto absolute inset-0 transition-opacity duration-1000 ${i === actual ? "opacity-100" : "pointer-events-none opacity-0"}`}
          style={fondo(p.imagen, p.deporte)}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-bg/10" />
          <span className="absolute right-5 top-4 z-10 rounded-md bg-black/50 px-2.5 py-1 text-[11px] uppercase tracking-[2px]">
            {p.etiqueta}
          </span>
          {i === actual && (
            <div className="aparecer relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center gap-4 px-4 pb-16">
              <h1 className="max-w-2xl font-display text-6xl leading-[.9] sm:text-8xl">
                {p.titulo}
                <br />
                <em className="not-italic text-accent">{p.destacado}</em>
              </h1>
              <p className="max-w-lg text-lg text-[#cdd6e0]">{p.texto}</p>
              <Link
                href={p.link}
                className="w-max rounded-xl bg-accent px-5 py-3 font-bold text-[#0b0f05] shadow-[0_10px_30px_-10px_var(--accent)] transition hover:-translate-y-0.5"
              >
                {p.boton} →
              </Link>
            </div>
          )}
        </div>
      ))}
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {items.map((p, i) => (
          <button
            key={p.id}
            aria-label={`Ver ${i + 1}`}
            onClick={() => setActual(i)}
            className={`h-2.5 rounded-full transition-all ${i === actual ? "w-8 bg-accent" : "w-2.5 bg-white/35"}`}
          />
        ))}
      </div>
    </section>
  );
}
