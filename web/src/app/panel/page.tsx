import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Mi club", robots: { index: false } };

type Fila = { club_id: string; clubs: { nombre: string; barrio: string | null; estado: string } | null };

export default async function MisClubes() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/");

  const { data } = await (await crearClienteServidor())
    .from("club_members")
    .select("club_id, clubs(nombre, barrio, estado)")
    .eq("user_id", usuario.id)
    .eq("rol", "DUENIO");
  const clubes = (data ?? []) as unknown as Fila[];

  if (clubes.length === 1) redirect(`/panel/${clubes[0].club_id}`);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-5xl tracking-wide">Mis <span className="text-accent">clubes</span></h1>
      {clubes.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-muted">
          Tu cuenta ({usuario.email}) no administra ningún club todavía. Si tenés un club y querés sumarte a JugáYa, escribinos.
        </p>
      ) : (
        <div className="mt-6 grid gap-3">
          {clubes.map((c) => (
            <Link key={c.club_id} href={`/panel/${c.club_id}`}
              className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 transition hover:border-accent">
              <span>
                <b className="text-lg">{c.clubs?.nombre}</b>
                {c.clubs?.barrio && <span className="text-muted"> · {c.clubs.barrio}</span>}
              </span>
              <span className="text-sm text-muted">{c.clubs?.estado === "ACTIVO" ? "🟢 Publicado" : c.clubs?.estado === "SUSPENDIDO" ? "🔴 Suspendido" : "🟡 Sin publicar"} →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
