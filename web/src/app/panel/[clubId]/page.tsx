import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { FranjaForm } from "./acciones";
import {
  BotonPublicar, SeccionCanchas, SeccionCobros, SeccionDatos, SeccionFotos, SeccionReglas, type ClubPanel,
} from "./secciones";

export const metadata: Metadata = { title: "Mi club", robots: { index: false } };

type FilaHorario = { dia_semana: number; hora_desde: string; hora_hasta: string; duracion_min: number; precio: number };

/** Agrupa las filas por día de la base en franjas (mismo horario y precio → una franja con varios días). */
function aFranjas(filas: FilaHorario[]): FranjaForm[] {
  const hm = (t: string) => (t.startsWith("24") ? "24:00" : t.slice(0, 5));
  const grupos = new Map<string, FranjaForm>();
  for (const f of filas) {
    const clave = `${f.hora_desde}|${f.hora_hasta}|${f.duracion_min}|${f.precio}`;
    const g = grupos.get(clave) ?? { dias: [], desde: hm(f.hora_desde), hasta: hm(f.hora_hasta), duracion: f.duracion_min, precio: Number(f.precio) };
    g.dias.push(f.dia_semana);
    grupos.set(clave, g);
  }
  return [...grupos.values()].map((g) => ({ ...g, dias: g.dias.sort() })).sort((a, b) => a.desde.localeCompare(b.desde));
}

export default async function PanelClub({ params }: PageProps<"/panel/[clubId]">) {
  const { clubId } = await params;
  const usuario = await usuarioActual();
  if (!usuario) redirect("/");

  const supabase = await crearClienteServidor();
  const [{ data: miembro }, { data: c }, { data: sedes }] = await Promise.all([
    supabase.from("club_members").select("rol").eq("club_id", clubId).eq("user_id", usuario.id).maybeSingle(),
    supabase.from("clubs").select("*, club_photos(id, url, orden), courts(*, court_schedules(*))").eq("id", clubId).maybeSingle(),
    supabase.from("club_members").select("club_id, clubs(nombre)").eq("user_id", usuario.id).eq("rol", "DUENIO"),
  ]);
  if (!c || !(miembro?.rol === "DUENIO" || usuario.esRoot)) notFound();

  const club: ClubPanel = {
    id: c.id, slug: c.slug, nombre: c.nombre, estado: c.estado,
    descripcion: c.descripcion ?? "", direccion: c.direccion ?? "", barrio: c.barrio ?? "",
    whatsapp: c.whatsapp ?? "", horario: c.horario_atencion ?? "", servicios: c.servicios ?? [],
    portada: c.portada_url,
    reglas: {
      senaPct: Number(c.sena_pct), plazoPagoHoras: c.plazo_pago_horas, corteHoras: c.corte_horas,
      plazoUmHoras: c.plazo_um_horas, descuentoUmPct: Number(c.descuento_um_pct), permiteDesafios: c.permite_desafios,
    },
    cobros: {
      mercadoPago: c.acepta_mercado_pago, transferencia: c.acepta_transferencia,
      alias: c.transferencia_alias ?? "", cbu: c.transferencia_cbu ?? "", titular: c.transferencia_titular ?? "",
    },
    fotos: [...c.club_photos].sort((a: { orden: number }, b: { orden: number }) => a.orden - b.orden).map((f: { id: string; url: string }) => ({ id: f.id, url: f.url })),
    canchas: [...c.courts]
      .sort((a: { orden: number }, b: { orden: number }) => a.orden - b.orden)
      .map((k: { id: string; nombre: string; deporte: string; tipo: string | null; techada: boolean; activa: boolean; court_schedules: FilaHorario[] }) => ({
        id: k.id, nombre: k.nombre, deporte: k.deporte, tipo: k.tipo ?? "", techada: k.techada, activa: k.activa,
        franjas: aFranjas(k.court_schedules),
      })),
  };

  const activas = club.canchas.filter((k) => k.activa);
  const pasos = [
    { id: "datos", titulo: "Datos del club", listo: !!(club.descripcion && club.direccion && club.whatsapp) },
    { id: "fotos", titulo: "Fotos", listo: club.fotos.length > 0 },
    { id: "canchas", titulo: "Canchas y horarios", listo: activas.length > 0 && activas.every((k) => k.franjas.length > 0) },
    { id: "reglas", titulo: "Reglas de reserva", listo: true },
    { id: "cobros", titulo: "Cobros", listo: club.cobros.mercadoPago || club.cobros.transferencia },
  ];
  const listo = pasos.every((p) => p.listo);
  const publicado = club.estado === "ACTIVO";
  const otrasSedes = (sedes ?? []).filter((s) => s.club_id !== club.id);

  const secciones = [
    { id: "datos", titulo: "1 · Datos del club", contenido: <SeccionDatos club={club} /> },
    { id: "fotos", titulo: "2 · Fotos", contenido: <SeccionFotos club={club} /> },
    { id: "canchas", titulo: "3 · Canchas, horarios y precios", contenido: <SeccionCanchas club={club} /> },
    { id: "reglas", titulo: "4 · Reglas de reserva", contenido: <SeccionReglas club={club} /> },
    { id: "cobros", titulo: "5 · Cobros", contenido: <SeccionCobros club={club} /> },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Panel del club</p>
          <h1 className="font-display text-5xl tracking-wide">{club.nombre}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {otrasSedes.length > 0 && (
            <details className="relative">
              <summary className="cursor-pointer rounded-xl border border-line px-4 py-2 text-sm font-semibold">Cambiar de sede ▾</summary>
              <div className="absolute right-0 z-10 mt-1 min-w-56 rounded-xl border border-line bg-card p-1.5">
                {otrasSedes.map((s) => (
                  <Link key={s.club_id} href={`/panel/${s.club_id}`} className="block rounded-lg px-3 py-2 text-sm hover:bg-card2">
                    {(s.clubs as unknown as { nombre: string } | null)?.nombre ?? "Sede"}
                  </Link>
                ))}
              </div>
            </details>
          )}
          <Link href={`/panel/${club.id}/reservas`} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black">
            📅 Reservas y comprobantes
          </Link>
          <Link href={`/club/${club.slug}`} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent">
            👁️ Ver mi página {publicado ? "" : "(vista previa)"}
          </Link>
        </div>
      </div>

      <section className={`mt-6 rounded-[18px] border p-5 ${publicado ? "border-ok/40 bg-ok/5" : "border-accent/40 bg-accent/5"}`}>
        {publicado ? (
          <p className="font-semibold text-ok">🟢 Tu club está publicado: los jugadores ya pueden ver tus turnos.</p>
        ) : club.estado === "SUSPENDIDO" ? (
          <p className="font-semibold text-hot">🔴 Tu club está suspendido. Comunicate con JugáYa para reactivarlo.</p>
        ) : (
          <>
            <h2 className="text-lg font-semibold">Completá estos pasos para publicar tu club</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-5">
              {pasos.map((p) => (
                <li key={p.id}>
                  <a href={`#${p.id}`} className={`block rounded-xl border px-3 py-2 text-sm font-semibold ${p.listo ? "border-ok/40 text-ok" : "border-line text-muted hover:text-text"}`}>
                    {p.listo ? "✔" : "○"} {p.titulo}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-4"><BotonPublicar clubId={club.id} listo={listo} /></div>
          </>
        )}
      </section>

      {secciones.map((s) => (
        <section key={s.id} id={s.id} className="mt-6 scroll-mt-20 rounded-[18px] border border-line bg-card p-5">
          <h2 className="mb-4 text-xl font-semibold">{s.titulo}</h2>
          {s.contenido}
        </section>
      ))}
    </div>
  );
}
