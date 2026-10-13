import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { GrillaTurnos } from "@/components/GrillaTurnos";
import { obtenerClub, obtenerTurnosPorDia, proximosDias } from "@/lib/datos";
import { DEPORTES, fondo } from "@/lib/deportes";
import { horasTexto, plata } from "@/lib/reglas";

export async function generateMetadata({ params }: PageProps<"/club/[slug]">): Promise<Metadata> {
  const club = await obtenerClub((await params).slug);
  return club ? { title: club.nombre, description: club.descripcion } : {};
}

export default async function PaginaClub({ params, searchParams }: PageProps<"/club/[slug]">) {
  await connection();
  const club = await obtenerClub((await params).slug);
  if (!club) notFound();

  const ahora = new Date();
  const dias = proximosDias(14, ahora);
  const turnosPorDia = await obtenerTurnosPorDia(club, dias, ahora);
  const { dia } = await searchParams;
  const diaInicial = typeof dia === "string" && dias.includes(dia) ? dia : dias[0];
  const deporte = club.deportes[0];
  const r = club.reglas;

  return (
    <>
      <section className="foto relative h-[340px] overflow-hidden rounded-b-[34px] sm:h-[380px]" style={fondo(club.portada, deporte)}>
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-bg/50" />
        <div className="aparecer absolute inset-x-0 bottom-7 mx-auto max-w-6xl px-4">
          <span className="rounded-full border border-line bg-card2/80 px-3 py-1.5 text-[13px] font-semibold">
            {DEPORTES[deporte].icono} {DEPORTES[deporte].nombre}
            {club.destacado && <b className="text-accent"> · ★ Destacado</b>}
          </span>
          <h1 className="mt-3 font-display text-6xl leading-none sm:text-7xl">{club.nombre}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="font-bold text-[#ffd23f]">
              ★ {club.rating} <span className="font-normal text-muted">({club.ratingCantidad} opiniones)</span>
            </span>
            <span className="text-muted">📌 {[club.direccion, club.barrio].filter(Boolean).join(", ")}</span>
            {club.distanciaKm != null && <span className="text-muted">📍 a {club.distanciaKm} km</span>}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pt-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {club.canchas.length ? (
            <GrillaTurnos club={club} dias={dias} diaInicial={diaInicial} turnosPorDia={turnosPorDia} />
          ) : (
            <p className="rounded-[18px] border border-dashed border-line p-8 text-center text-muted">
              Este club todavía está cargando sus canchas y horarios. ¡Volvé pronto!
            </p>
          )}

          <section className="rounded-[18px] border border-line bg-card p-5">
            <h2 className="text-xl font-semibold">Galería</h2>
            <div className="mt-3 grid auto-rows-[120px] grid-cols-2 gap-2.5 sm:grid-cols-4">
              {club.fotos.map((f, i) => (
                <div
                  key={f + i}
                  className={`foto rounded-xl transition hover:scale-[1.03] hover:brightness-110 ${i === 0 ? "col-span-2 row-span-2" : ""}`}
                  style={fondo(f, deporte)}
                />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[18px] border border-line bg-card p-5">
            <h2 className="text-lg font-semibold">Sobre el club</h2>
            <p className="mt-2 text-sm text-muted">{club.descripcion}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {club.servicios.map((s) => (
                <span key={s} className="rounded-lg border border-line bg-bg2 px-2.5 py-1 text-xs font-semibold">{s}</span>
              ))}
            </div>
            <ul className="mt-4 space-y-1.5 text-sm">
              <li>🕒 {club.horario}</li>
              <li>💸 Seña mínima: <b>{r.senaPct}%</b> · plazo para pagarla: <b>{horasTexto(r.plazoPagoHoras)}</b></li>
              <li>🔥 Último momento: <b>-{r.descuentoUmPct}%</b> en los {horasTexto(r.corteHoras)} previos</li>
              <li>
                💳 {[club.aceptaMercadoPago && "Mercado Pago", club.aceptaTransferencia && "Transferencia"].filter(Boolean).join(" · ")}
              </li>
              <li>
                <a href={`https://wa.me/${club.whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-bold text-[#25d366]">
                  💬 WhatsApp del club
                </a>
              </li>
            </ul>
          </section>
          <section className="rounded-[18px] border border-line bg-card p-5">
            <h2 className="text-lg font-semibold">Canchas</h2>
            <div className="mt-3 space-y-2 text-sm">
              {club.canchas.map((c) => (
                <div key={c.id} className="flex justify-between gap-2 rounded-xl bg-bg2 px-3 py-2.5">
                  <span>
                    {c.nombre} <span className="text-muted">· {c.tipo}{c.techada ? " · techada" : ""}</span>
                  </span>
                  <b>{plata(c.grilla[0]?.precio ?? 0)}</b>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
