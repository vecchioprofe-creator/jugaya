import Link from "next/link";
import { DEPORTES, fondo } from "@/lib/deportes";
import type { Club } from "@/lib/tipos";

export function TarjetaClub({ club, indice = 0 }: { club: Club; indice?: number }) {
  const deporte = club.deportes[0];
  const tipos = [...new Set(club.canchas.map((c) => c.tipo))].slice(0, 2).join(" · ");
  return (
    <Link
      href={`/club/${club.slug}`}
      className="aparecer group block overflow-hidden rounded-[18px] border border-line bg-card transition duration-300 hover:-translate-y-2 hover:border-accent/50 hover:shadow-[0_30px_60px_-25px_rgb(198_255_61/.35)]"
      style={{ animationDelay: `${indice * 60}ms` }}
    >
      <div className="relative h-44 overflow-hidden">
        <div className="foto absolute inset-0 transition-transform duration-700 group-hover:scale-110" style={fondo(club.portada, deporte)} />
        <div className="absolute inset-x-2.5 top-2.5 flex justify-between text-xs font-bold">
          {club.destacado ? <span className="rounded-lg bg-accent px-2.5 py-1 text-black">★ DESTACADO</span> : <span />}
          <span className="rounded-lg bg-black/60 px-2.5 py-1 backdrop-blur">📍 {club.distanciaKm} km</span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold">{club.nombre}</h3>
        <p className="text-sm text-muted">📌 {club.direccion}, {club.barrio}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="truncate rounded-full border border-line bg-card2 px-3 py-1 text-[13px] font-semibold">
            {DEPORTES[deporte].icono} {tipos}
          </span>
          <span className="shrink-0 text-sm font-bold text-[#ffd23f]">
            ★ {club.rating} <span className="font-normal text-muted">({club.ratingCantidad})</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
