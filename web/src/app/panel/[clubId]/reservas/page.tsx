import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { fechaHora, plata } from "@/lib/reglas";
import { usuarioActual } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CobroEnClub, RevisarComprobante } from "./controles";

export const metadata: Metadata = { title: "Reservas", robots: { index: false } };

type Pago = { id: string; monto: number; medio: string; estado: string; comprobante_path: string | null; created_at: string; team_player_id: string | null; motivo_rechazo: string | null };
type Reserva = {
  id: string; codigo: string; inicio: string; estado: string; tipo: string; precio_final: number; sena_minima: number; vence_at: string | null;
  courts: { nombre: string } | null;
  teams: { id: string; nombre: string | null; team_players: { id: string; nombre: string; monto_acreditado: number; activo: boolean; orden: number }[] }[];
  payments: Pago[];
};

const ESTADO: Record<string, { t: string; c: string }> = {
  BUSCA_RIVAL: { t: "Busca rival", c: "bg-accent2/15 text-accent2" },
  EN_PROCESO: { t: "Juntando seña", c: "bg-warn/15 text-warn" },
  CONFIRMADO: { t: "Seña cubierta", c: "bg-ok/15 text-ok" },
  SALDADO: { t: "Saldado", c: "bg-accent2/15 text-accent2" },
  VENCIDO: { t: "Vencido · retenido", c: "bg-hot/15 text-hot" },
  CANCELADO_CLUB: { t: "Cancelado", c: "bg-hot/15 text-hot" },
  JUGADO: { t: "Jugado", c: "bg-card2 text-muted" },
};
const haceHoras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const MEDIO: Record<string, string> ={ TRANSFERENCIA: "Transferencia", MERCADO_PAGO: "Mercado Pago", EN_CLUB: "En el club" };

export default async function ReservasClub({ params }: PageProps<"/panel/[clubId]/reservas">) {
  const { clubId } = await params;
  const usuario = await usuarioActual();
  if (!usuario) redirect("/");
  const supabase = await crearClienteServidor();

  const [{ data: miembro }, { data: club }] = await Promise.all([
    supabase.from("club_members").select("rol").eq("club_id", clubId).eq("user_id", usuario.id).maybeSingle(),
    supabase.from("clubs").select("nombre").eq("id", clubId).maybeSingle(),
  ]);
  if (!club || !(miembro || usuario.esRoot)) notFound();

  const desde = haceHoras(3); // incluye los partidos que se están jugando
  const { data } = await supabase
    .from("bookings")
    .select(`id, codigo, inicio, estado, tipo, precio_final, sena_minima, vence_at, courts(nombre),
      teams(id, nombre, team_players(id, nombre, monto_acreditado, activo, orden)),
      payments(id, monto, medio, estado, comprobante_path, created_at, team_player_id, motivo_rechazo)`)
    .eq("club_id", clubId)
    .gte("inicio", desde)
    .order("inicio")
    .limit(200);
  const reservas = (data ?? []) as unknown as Reserva[];

  // comprobantes por revisar, con un link temporal (30 min) para verlos
  const pendientes = reservas.flatMap((r) => r.payments.filter((p) => p.estado === "EN_REVISION").map((p) => ({ r, p })));
  const rutas = pendientes.map(({ p }) => p.comprobante_path).filter((x): x is string => !!x);
  const { data: firmadas } = rutas.length
    ? await supabase.storage.from("comprobantes").createSignedUrls(rutas, 1800)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlDe = (ruta: string | null) => firmadas?.find((f) => f.path === ruta)?.signedUrl;
  const jugadorDe = (r: Reserva, id: string | null) => r.teams.flatMap((t) => t.team_players).find((j) => j.id === id)?.nombre ?? "—";

  const activas = reservas.filter((r) => !["VENCIDO", "CANCELADO_CLUB"].includes(r.estado));
  const porDia = new Map<string, Reserva[]>();
  for (const r of activas) {
    const dia = new Date(r.inicio).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "long" });
    porDia.set(dia, [...(porDia.get(dia) ?? []), r]);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link href={`/panel/${clubId}`} className="text-sm text-muted hover:text-text">← Panel de {club.nombre}</Link>
      <h1 className="mt-1 font-display text-5xl tracking-wide">Reservas</h1>

      <section className="mt-6 rounded-[18px] border border-warn/40 bg-warn/5 p-5">
        <h2 className="text-xl font-semibold">🧾 Comprobantes por revisar {pendientes.length > 0 && <span className="text-warn">({pendientes.length})</span>}</h2>
        {pendientes.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No hay comprobantes pendientes. 👌</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pendientes.map(({ r, p }) => {
              const url = urlDe(p.comprobante_path);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <b>{plata(p.monto)}</b> de <b>{jugadorDe(r, p.team_player_id)}</b>
                    <div className="text-xs capitalize text-muted">
                      Turno {fechaHora(new Date(r.inicio))} · {r.courts?.nombre} · grupo{" "}
                      <Link href={`/g/${r.codigo}`} className="font-semibold text-accent hover:underline">{r.codigo}</Link>
                      {r.vence_at && <> · vence {fechaHora(new Date(r.vence_at))}</>}
                    </div>
                  </div>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:border-accent">
                      👁️ Ver comprobante
                    </a>
                  ) : <span className="text-xs text-hot">Comprobante no disponible</span>}
                  <RevisarComprobante clubId={clubId} pagoId={p.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">📅 Próximos turnos reservados</h2>
        {activas.length === 0 && <p className="mt-2 text-sm text-muted">Todavía no hay reservas.</p>}
        {[...porDia.entries()].map(([dia, lista]) => (
          <div key={dia} className="mt-4">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">{dia}</h3>
            <div className="space-y-2">
              {lista.map((r) => {
                const aprobado = r.payments.filter((p) => p.estado === "APROBADO").reduce((a, p) => a + Number(p.monto), 0);
                const revision = r.payments.filter((p) => p.estado === "EN_REVISION").reduce((a, p) => a + Number(p.monto), 0);
                const jugadores = r.teams.flatMap((t) => t.team_players).filter((j) => j.activo).sort((a, b) => a.orden - b.orden);
                const est = ESTADO[r.estado] ?? { t: r.estado, c: "bg-card2" };
                return (
                  <details key={r.id} className="group rounded-xl border border-line bg-card">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-3">
                      <b className="font-display text-2xl">{new Date(r.inicio).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</b>
                      <span className="text-sm">{r.courts?.nombre}</span>
                      <span className="text-sm text-muted">{jugadores.length} jugadores</span>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${est.c}`}>{est.t}</span>
                      <span className="ml-auto text-sm">
                        <b className="text-ok">{plata(aprobado)}</b> <span className="text-muted">/ {plata(r.precio_final)}</span>
                        {revision > 0 && <span className="text-warn"> · {plata(revision)} en revisión</span>}
                      </span>
                    </summary>
                    <div className="border-t border-line p-3">
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {jugadores.map((j) => (
                          <div key={j.id} className="flex justify-between rounded-lg bg-bg2 px-3 py-1.5 text-sm">
                            <span>{j.nombre}</span>
                            <b className={Number(j.monto_acreditado) ? "text-ok" : "text-muted"}>{plata(Number(j.monto_acreditado))}</b>
                          </div>
                        ))}
                      </div>
                      {r.payments.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs text-muted">
                          {r.payments.map((p) => (
                            <li key={p.id}>
                              {new Date(p.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
                              {" · "}{MEDIO[p.medio] ?? p.medio} · <b className="text-text">{plata(p.monto)}</b>
                              {p.team_player_id && <> · {jugadorDe(r, p.team_player_id)}</>} · {p.estado.toLowerCase().replace("_", " ")}
                              {p.motivo_rechazo && <> ({p.motivo_rechazo})</>}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <CobroEnClub clubId={clubId} reservaId={r.id} falta={Number(r.precio_final) - aprobado - revision} />
                        <Link href={`/g/${r.codigo}`} className="text-xs font-semibold text-accent hover:underline">Ver grupo {r.codigo} →</Link>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
