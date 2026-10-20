import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fechaAR, plata, ZONA } from "@/lib/reglas";
import { usuarioActual } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { cambiarEstadoClub, marcarPago } from "./acciones";
import { FormCrearClub } from "./FormCrearClub";

export const metadata: Metadata = { title: "Root", robots: { index: false } };

type FilaClubRoot = {
  id: string; slug: string; nombre: string; barrio: string | null; estado: "PENDIENTE_ACTIVACION" | "ACTIVO" | "SUSPENDIDO";
  plan: string | null; monto_mensual: number | null;
  club_members: { email: string; rol: string; user_id: string | null }[];
  subscriptions: { id: string; monto: number; pagado: boolean; fecha_pago: string | null }[];
};

const ETIQUETA_ESTADO = {
  PENDIENTE_ACTIVACION: { texto: "Pendiente", clase: "bg-warn/15 text-warn" },
  ACTIVO: { texto: "Activo", clase: "bg-ok/15 text-ok" },
  SUSPENDIDO: { texto: "Suspendido", clase: "bg-hot/15 text-hot" },
};

export default async function PanelRoot() {
  const usuario = await usuarioActual();
  if (!usuario?.esRoot) notFound(); // a quien no es root ni le mostramos que existe

  const supabase = await crearClienteServidor();
  await supabase.rpc("generar_suscripciones_mes"); // idempotente: asegura las filas del mes
  const periodo = fechaAR(new Date()).slice(0, 7) + "-01";
  const { data, error } = await supabase
    .from("clubs")
    .select("id, slug, nombre, barrio, estado, plan, monto_mensual, club_members(email, rol, user_id), subscriptions(id, monto, pagado, fecha_pago)")
    .eq("subscriptions.periodo", periodo)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const clubes = data as FilaClubRoot[];

  const subs = clubes.flatMap((c) => c.subscriptions);
  const cobrado = subs.filter((s) => s.pagado).reduce((a, s) => a + Number(s.monto), 0);
  const pendiente = subs.filter((s) => !s.pagado).reduce((a, s) => a + Number(s.monto), 0);
  const mes = new Date(periodo + "T12:00:00-03:00").toLocaleDateString("es-AR", { timeZone: ZONA, month: "long", year: "numeric" });

  const kpis = [
    { t: "Clubes activos", v: String(clubes.filter((c) => c.estado === "ACTIVO").length) },
    { t: "Pendientes de activar", v: String(clubes.filter((c) => c.estado === "PENDIENTE_ACTIVACION").length) },
    { t: `Cobrado (${mes})`, v: plata(cobrado), c: "text-ok" },
    { t: `Por cobrar (${mes})`, v: plata(pendiente), c: pendiente ? "text-hot" : "" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-5xl tracking-wide">
        Administración <span className="text-violet">root</span>
      </h1>
      <p className="text-sm text-muted">Conectado como {usuario.email}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.t} className="rounded-[18px] border border-line bg-card p-4">
            <small className="text-muted">{k.t}</small>
            <b className={`mt-1 block font-display text-4xl ${k.c ?? ""}`}>{k.v}</b>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-[18px] border border-line bg-card p-5">
        <h2 className="mb-4 text-xl font-semibold">Crear cuenta de club</h2>
        <FormCrearClub />
        <p className="mt-3 text-xs text-muted">
          El club queda <b>pendiente</b> hasta que el dueño entre con ese Gmail y cargue sus canchas, o hasta que lo actives vos.
        </p>
      </section>

      <section className="mt-6 overflow-x-auto rounded-[18px] border border-line bg-card p-5">
        <h2 className="mb-3 text-xl font-semibold capitalize">Clubes y suscripciones · {mes}</h2>
        {clubes.length === 0 ? (
          <p className="text-muted">Todavía no creaste ningún club.</p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="p-2">Club</th>
                <th className="p-2">Dueño</th>
                <th className="p-2">Plan</th>
                <th className="p-2">Mensual</th>
                <th className="p-2">¿Pagó?</th>
                <th className="p-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {clubes.map((c) => {
                const duenio = c.club_members.find((m) => m.rol === "DUENIO");
                const sub = c.subscriptions[0];
                const est = ETIQUETA_ESTADO[c.estado];
                return (
                  <tr key={c.id} className="border-t border-line">
                    <td className="p-2">
                      <Link href={`/club/${c.slug}`} className="font-semibold hover:text-accent">{c.nombre}</Link>
                      {c.barrio && <div className="text-xs text-muted">{c.barrio}</div>}
                      <Link href={`/panel/${c.id}`} className="text-xs font-semibold text-accent hover:underline">⚙️ Configurar</Link>
                    </td>
                    <td className="p-2">
                      <div className="text-muted">{duenio?.email ?? "—"}</div>
                      <div className={`text-xs ${duenio?.user_id ? "text-ok" : "text-warn"}`}>
                        {duenio?.user_id ? "✔ ya ingresó" : "⏳ todavía no ingresó"}
                      </div>
                    </td>
                    <td className="p-2">{c.plan ?? "—"}</td>
                    <td className="p-2">{sub ? plata(sub.monto) : "—"}</td>
                    <td className="p-2">
                      {sub && (
                        <form action={marcarPago} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={sub.id} />
                          <input type="hidden" name="pagado" value={String(!sub.pagado)} />
                          <button
                            aria-label={sub.pagado ? "Marcar como no pagado" : "Marcar como pagado"}
                            className={`relative h-6 w-11 rounded-full transition ${sub.pagado ? "bg-ok" : "bg-line"}`}
                          >
                            <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${sub.pagado ? "left-[22px]" : "left-0.5"}`} />
                          </button>
                          <span className={`text-xs ${sub.pagado ? "text-ok" : "text-hot"}`}>
                            {sub.pagado ? `Pagó ${sub.fecha_pago ?? ""}` : "Debe"}
                          </span>
                        </form>
                      )}
                    </td>
                    <td className="p-2">
                      <span className={`rounded-md px-2 py-1 text-xs font-bold ${est.clase}`}>{est.texto}</span>
                      <form action={cambiarEstadoClub} className="mt-1.5 flex gap-1.5">
                        <input type="hidden" name="id" value={c.id} />
                        {c.estado !== "ACTIVO" && (
                          <button name="estado" value="ACTIVO" className="text-xs font-semibold text-ok hover:underline">Activar</button>
                        )}
                        {c.estado !== "SUSPENDIDO" && (
                          <button name="estado" value="SUSPENDIDO" className="text-xs font-semibold text-hot hover:underline">Suspender</button>
                        )}
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
