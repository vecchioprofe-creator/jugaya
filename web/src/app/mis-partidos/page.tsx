import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { fechaHora } from "@/lib/reglas";
import { usuarioActual } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Mis partidos", robots: { index: false } };

type Fila = {
  teams: {
    admin_id: string | null;
    bookings: { codigo: string; inicio: string; estado: string; clubs: { nombre: string } | null; courts: { nombre: string } | null } | null;
  } | null;
};

const ESTADO: Record<string, string> = {
  BUSCA_RIVAL: "⚔️ Buscando rival", EN_PROCESO: "⏳ Juntando la seña", CONFIRMADO: "✅ Confirmado", SALDADO: "🎉 Todo pago",
  JUGADO: "Jugado", VENCIDO: "❌ Venció", CANCELADO_CLUB: "❌ Cancelado por el club",
};

type Partido = {
  codigo: string; inicio: string; estado: string; esAdmin: boolean;
  clubs: { nombre: string } | null; courts: { nombre: string } | null;
};

function Lista({ items }: { items: Partido[] }) {
  return (
    <div className="mt-3 grid gap-2.5">
      {items.map((p) => (
        <Link key={p.codigo} href={`/g/${p.codigo}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-card p-4 transition hover:border-accent">
          <span>
            <b className="capitalize">{fechaHora(new Date(p.inicio))} hs</b>
            <span className="text-muted"> · {p.clubs?.nombre} · {p.courts?.nombre}</span>
            {p.esAdmin && <span className="ml-2 rounded-md bg-violet/20 px-2 py-0.5 text-xs font-bold text-violet">Organizás vos</span>}
          </span>
          <span className="text-sm">{ESTADO[p.estado] ?? p.estado} →</span>
        </Link>
      ))}
    </div>
  );
}

export default async function MisPartidos() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/");

  const { data } = await (await crearClienteServidor())
    .from("team_players")
    .select("teams(admin_id, bookings(codigo, inicio, estado, clubs(nombre), courts(nombre)))")
    .eq("user_id", usuario.id)
    .eq("activo", true);
  const partidos = ((data ?? []) as unknown as Fila[])
    .map((f) => ({ ...f.teams!.bookings!, esAdmin: f.teams!.admin_id === usuario.id }))
    .filter((b) => b.codigo)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const ahora = new Date().toISOString();
  const proximos = partidos.filter((p) => p.inicio >= ahora);
  const pasados = partidos.filter((p) => p.inicio < ahora).reverse();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-5xl tracking-wide">Mis <span className="text-accent">partidos</span></h1>
      {partidos.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Todavía no reservaste ningún turno. <Link href="/#clubes" className="font-semibold text-accent">Buscá una cancha →</Link>
        </p>
      ) : (
        <>
          <h2 className="mt-6 text-lg font-semibold">Próximos</h2>
          {proximos.length ? <Lista items={proximos} /> : <p className="mt-2 text-sm text-muted">No tenés partidos próximos.</p>}
          {pasados.length > 0 && (<><h2 className="mt-8 text-lg font-semibold text-muted">Anteriores</h2><Lista items={pasados} /></>)}
        </>
      )}
    </div>
  );
}
