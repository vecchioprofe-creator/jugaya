import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { fechaHora, plata } from "@/lib/reglas";
import { usuarioActual } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { Compartir, CuentaRegresiva, ListaEquipo, type DatosPago, type EquipoG } from "./grupo";

type Fila = {
  id: string; codigo: string; inicio: string; tipo: string; estado: string;
  precio_final: number; sena_minima: number; vence_at: string | null; cancelado_motivo: string | null;
  clubs: {
    nombre: string; slug: string; direccion: string | null; barrio: string | null; portada_url: string | null;
    acepta_transferencia: boolean; transferencia_alias: string | null; transferencia_cbu: string | null; transferencia_titular: string | null;
  } | null;
  courts: { nombre: string; tipo: string | null } | null;
  teams: {
    id: string; lado: "A" | "B"; nombre: string | null; admin_id: string | null; sena_minima: number;
    team_players: { id: string; nombre: string; monto_acreditado: number; activo: boolean; orden: number }[];
  }[];
};

// una sola consulta por pedido aunque la usen generateMetadata y la página
const obtenerGrupo = cache(async (codigo: string) => {
  const { data } = await (await crearClienteServidor())
    .from("bookings")
    .select(`id, codigo, inicio, tipo, estado, precio_final, sena_minima, vence_at, cancelado_motivo,
      clubs(nombre, slug, direccion, barrio, portada_url, acepta_transferencia, transferencia_alias, transferencia_cbu, transferencia_titular),
      courts(nombre, tipo),
      teams(id, lado, nombre, admin_id, sena_minima, team_players(id, nombre, monto_acreditado, activo, orden))`)
    .eq("codigo", codigo.toUpperCase())
    .maybeSingle();
  return data as Fila | null;
});

export async function generateMetadata({ params }: PageProps<"/g/[codigo]">): Promise<Metadata> {
  const g = await obtenerGrupo((await params).codigo);
  if (!g) return { title: "Grupo no encontrado" };
  const titulo = `Partido · ${fechaHora(new Date(g.inicio))} · ${g.clubs?.nombre ?? ""}`;
  return {
    title: titulo,
    description: "Sumate al grupo y pagá tu parte de la seña desde acá.",
    openGraph: { title: titulo, images: g.clubs?.portada_url ? [g.clubs.portada_url] : [] },
    robots: { index: false },
  };
}

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  BUSCA_RIVAL: { texto: "Buscando rival", clase: "bg-accent2/15 text-accent2" },
  EN_PROCESO: { texto: "En proceso de reserva", clase: "bg-warn/15 text-warn" },
  CONFIRMADO: { texto: "¡Turno confirmado! ✔", clase: "bg-ok/15 text-ok" },
  SALDADO: { texto: "Todo pago 🎉", clase: "bg-ok/15 text-ok" },
  JUGADO: { texto: "Partido jugado", clase: "bg-card2 text-muted" },
  VENCIDO: { texto: "Venció: no se llegó a la seña", clase: "bg-hot/15 text-hot" },
  CANCELADO_CLUB: { texto: "Cancelado por el club", clase: "bg-hot/15 text-hot" },
};

export default async function PaginaGrupo({ params, searchParams }: PageProps<"/g/[codigo]">) {
  const { codigo } = await params;
  const { nuevo } = await searchParams;
  const g = await obtenerGrupo(codigo);
  if (!g || !g.clubs) notFound();

  const supabase = await crearClienteServidor();
  const usuario = await usuarioActual();
  const [{ data: resumen }, { data: enRevision }] = await Promise.all([
    supabase.rpc("resumen_pagos", { p_booking: g.id }),
    // solo devuelve filas a quien puede verlas (admin del grupo, quien pagó, el club)
    supabase.from("payments").select("team_player_id, monto").eq("booking_id", g.id).eq("estado", "EN_REVISION"),
  ]);
  const aprobado = Number(resumen?.[0]?.aprobado ?? 0);
  const revision = Number(resumen?.[0]?.en_revision ?? 0);

  const teams = [...g.teams].sort((a, b) => a.lado.localeCompare(b.lado));
  const esAdmin = teams.some((t) => t.admin_id && t.admin_id === usuario?.id);
  const contacto = usuario && !esAdmin && teams[0]
    ? ((await supabase.rpc("contacto_admin", { p_team: teams[0].id })).data as string | null)
    : null;

  const abierto = ["BUSCA_RIVAL", "EN_PROCESO", "CONFIRMADO"].includes(g.estado)
    && (!g.vence_at || new Date(g.vence_at) > new Date());
  const pago: DatosPago = {
    bookingId: g.id, codigo: g.codigo, abierto,
    aceptaTransferencia: g.clubs.acepta_transferencia,
    alias: g.clubs.transferencia_alias ?? "", cbu: g.clubs.transferencia_cbu ?? "", titular: g.clubs.transferencia_titular ?? "",
    falta: Math.max(0, Number(g.precio_final) - aprobado - revision),
  };
  const equipos: EquipoG[] = teams.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    senaMinima: Number(t.sena_minima),
    precioEquipo: Number(g.precio_final) / teams.length,
    esAdmin: t.admin_id === usuario?.id,
    jugadores: t.team_players
      .filter((j) => j.activo)
      .sort((a, b) => a.orden - b.orden)
      .map((j) => ({
        id: j.id,
        nombre: j.nombre,
        acreditado: Number(j.monto_acreditado),
        enRevision: (enRevision ?? []).filter((p) => p.team_player_id === j.id).reduce((a, p) => a + Number(p.monto), 0),
      })),
  }));

  const inicio = new Date(g.inicio);
  const estado = ESTADOS[g.estado] ?? { texto: g.estado, clase: "bg-card2" };
  const pct = (n: number) => `${Math.min(100, (n / Number(g.precio_final)) * 100)}%`;
  const textoCompartir = `⚽ Partido el ${fechaHora(inicio)} en ${g.clubs.nombre}. Pagá tu parte de la seña acá:`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {nuevo && esAdmin && (
        <div className="aparecer mb-5 rounded-2xl border border-accent/50 bg-accent/10 p-4 text-center">
          <b className="text-accent">¡Turno bloqueado! 🔒</b>
          <p className="text-sm">Ahora compartí este link con tu equipo para que cada uno pague su parte.</p>
        </div>
      )}

      <section className="rounded-[26px] border border-line bg-[radial-gradient(900px_300px_at_50%_-80px,rgb(198_255_61/.16),transparent)] bg-card p-5 text-center sm:p-7">
        <p className="text-sm text-muted">Grupo <b className="text-text">{g.codigo}</b></p>
        <h1 className="mt-1 font-display text-5xl capitalize leading-none sm:text-6xl">{fechaHora(inicio)} hs</h1>
        <p className="mt-2 text-muted">
          <Link href={`/club/${g.clubs.slug}`} className="font-semibold text-text hover:text-accent">{g.clubs.nombre}</Link>
          {" · "}{g.courts?.nombre}{g.courts?.tipo ? ` (${g.courts.tipo})` : ""}
          {g.clubs.direccion && <> · 📌 {[g.clubs.direccion, g.clubs.barrio].filter(Boolean).join(", ")}</>}
        </p>
        <span className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold ${estado.clase}`}>
          {abierto && g.estado === "EN_PROCESO" && <span className="latido size-2.5 rounded-full bg-current" />}
          {estado.texto}
        </span>
        {g.estado === "CANCELADO_CLUB" && g.cancelado_motivo && (
          <p className="mt-2 text-sm text-muted">Motivo: {g.cancelado_motivo}. El club se va a comunicar para devolver lo pagado.</p>
        )}

        {g.estado === "EN_PROCESO" && g.vence_at && abierto && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-muted">Tiempo para completar la seña (vence el <span className="capitalize">{fechaHora(new Date(g.vence_at))}</span>)</p>
            <CuentaRegresiva hasta={g.vence_at} />
          </div>
        )}

        <div className="mx-auto mt-5 max-w-lg text-left">
          <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-sm">
            <span>Pagado <b className="text-ok">{plata(aprobado)}</b>{revision > 0 && <span className="text-warn"> · {plata(revision)} en revisión</span>}</span>
            <span className="text-muted">Seña <b className="text-text">{plata(g.sena_minima)}</b> · Total <b className="text-text">{plata(g.precio_final)}</b></span>
          </div>
          <div className="relative h-3.5 overflow-hidden rounded-full border border-line bg-bg2">
            <div className="absolute inset-y-0 left-0 bg-warn/40" style={{ width: pct(aprobado + revision) }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent2 to-accent transition-all duration-1000" style={{ width: pct(aprobado) }} />
            <div className="absolute -inset-y-1 w-[3px] rounded bg-white" style={{ left: pct(Number(g.sena_minima)) }} title="Seña mínima" />
          </div>
        </div>

        <div className="mt-5"><Compartir texto={textoCompartir} /></div>
        {contacto && (
          <a href={`https://wa.me/${contacto}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-bold text-[#25d366]">
            💬 Hablar con quien organiza
          </a>
        )}
      </section>

      <div className="mt-5 space-y-5">
        {equipos.map((e) => <ListaEquipo key={e.id} equipo={e} pago={pago} />)}
      </div>

      {!g.clubs.acepta_transferencia && abierto && (
        <p className="mt-4 rounded-xl border border-line bg-card p-3 text-center text-sm text-muted">
          El pago online para este club se habilita pronto. Mientras tanto, coordiná el pago de la seña directamente con el club.
        </p>
      )}
      {esAdmin && (
        <p className="mt-4 text-center text-xs text-muted">
          Sos quien organiza: podés renombrar (✏️), eliminar (🗑️) o agregar jugadores. Si eliminás a alguien que pagó, su monto se reparte entre los demás.
        </p>
      )}
    </div>
  );
}
