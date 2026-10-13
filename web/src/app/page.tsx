import Link from "next/link";
import { connection } from "next/server";
import { Carrusel } from "@/components/Carrusel";
import { Catalogo } from "@/components/Catalogo";
import { obtenerClubes, obtenerPublicidades, obtenerUltimoMomento } from "@/lib/datos";
import { fechaAR, plata, ZONA } from "@/lib/reglas";

const MARQUESINA = [
  "⚽ Partidos todos los días",
  "🔥 Turnos de último momento con descuento",
  "💸 Pagá tu parte desde un link",
  "🙋 ¿Te falta uno? Solicitalo",
  "⚔️ Buscá rival a tu nivel",
  "🏆 Torneos abiertos",
];

function cuandoEs(iso: string, hoy: string, manana: string) {
  const f = fechaAR(new Date(iso));
  if (f === hoy) return "Hoy";
  if (f === manana) return "Mañana";
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: ZONA, weekday: "long" });
}

export default async function Inicio() {
  await connection(); // turnos y descuentos dependen de la hora actual
  const ahora = new Date();
  const [publicidades, clubes] = await Promise.all([obtenerPublicidades(), obtenerClubes()]);
  const ultimo = await obtenerUltimoMomento(clubes, 10, ahora);
  const hoy = fechaAR(ahora);
  const manana = fechaAR(new Date(ahora.getTime() + 86_400_000));

  return (
    <>
      <Carrusel items={publicidades} />

      <section id="clubes" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <h2 className="mb-5 font-display text-5xl tracking-wide">
          Elegí tu <span className="text-accent">deporte</span>
        </h2>
        {clubes.length ? (
          <Catalogo clubes={clubes} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
            🏗️ Pronto vas a ver acá los clubes y canchas. ¡Estamos sumando los primeros!
          </p>
        )}
      </section>

      <div className="overflow-hidden border-y border-line bg-bg2 py-3.5">
        <div className="marquesina flex w-max gap-10">
          {[...MARQUESINA, ...MARQUESINA].map((t, i) => (
            <span key={i} className="whitespace-nowrap font-display text-2xl text-muted">
              {t}
            </span>
          ))}
        </div>
      </div>

      <section id="ultimo-momento" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-5xl tracking-wide">
            🔥 Último <span className="text-accent">momento</span>
          </h2>
          <p className="text-sm text-muted">Turnos libres de los próximos días con descuento · la seña se paga en 24 h</p>
        </div>
        <div className="flex gap-3.5 overflow-x-auto pb-3">
          {ultimo.map(({ club, turno }) => (
            <Link
              key={club.id + turno.inicio + turno.canchaId}
              href={`/club/${club.slug}?dia=${fechaAR(new Date(turno.inicio))}`}
              className="relative w-56 shrink-0 rounded-2xl border border-line bg-card p-3.5 transition hover:-translate-y-1 hover:border-accent"
            >
              <span className="absolute right-2.5 top-2.5 rounded-lg bg-hot px-2 py-1 text-xs font-extrabold">
                -{turno.descuentoPct}%
              </span>
              <div className="font-display text-4xl leading-none text-accent">{turno.hora}</div>
              <div className="text-xs capitalize text-muted">{cuandoEs(turno.inicio, hoy, manana)}</div>
              <b className="mt-1 block truncate">{club.nombre}</b>
              <div className="truncate text-[13px] text-muted">
                {club.canchas.find((c) => c.id === turno.canchaId)?.tipo}
                {club.distanciaKm != null && ` · 📍 ${club.distanciaKm} km`}
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[13px]">
                <span>
                  <s className="text-muted">{plata(turno.precioLista)}</s> <b>{plata(turno.precio)}</b>
                </span>
                <span className="font-bold text-warn">Seña 24 h</span>
              </div>
            </Link>
          ))}
          {ultimo.length === 0 && <p className="text-muted">No hay turnos de último momento ahora.</p>}
        </div>
      </section>
    </>
  );
}
