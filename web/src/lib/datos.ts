// Capa de acceso a datos. Con Supabase configurado lee la base real;
// sin configurar (o para desarrollo) usa los datos de demostración.
import { CLUBES, PUBLICIDADES } from "./demo";
import { fechaAR, instanteAR, precioFinal, tiempoRestante, tipoPermitido } from "./reglas";
import { supabaseConfigurado } from "./supabase/config";
import { crearClienteServidor } from "./supabase/servidor";
import type { Cancha, Club, Deporte, Franja, Publicidad, Turno } from "./tipos";

// ---------------------------------------------------------------------
// Filas de la base (solo las columnas que usamos)
// ---------------------------------------------------------------------
type FilaHorario = { dia_semana: number; hora_desde: string; hora_hasta: string; duracion_min: number; precio: number };
type FilaCancha = {
  id: string; nombre: string; deporte: Deporte; tipo: string | null; techada: boolean; activa: boolean; orden: number;
  court_schedules: FilaHorario[];
};
type FilaClub = {
  id: string; slug: string; nombre: string; descripcion: string | null; direccion: string | null; barrio: string | null;
  whatsapp: string | null; horario_atencion: string | null; servicios: string[]; portada_url: string | null;
  destacado_hasta: string | null; rating_promedio: number; rating_cantidad: number;
  plazo_pago_horas: number; corte_horas: number; plazo_um_horas: number; sena_pct: number; descuento_um_pct: number;
  permite_desafios: boolean; acepta_mercado_pago: boolean; acepta_transferencia: boolean;
  club_photos: { url: string; orden: number }[];
  courts: FilaCancha[];
};
type Ocupacion = { court_id: string; inicio: string; fin: string; estado: string; vence_at: string | null };

const SELECT_CLUB = "*, club_photos(url, orden), courts(*, court_schedules(*))";
const ESTADOS_OCUPADOS = ["BUSCA_RIVAL", "EN_PROCESO", "CONFIRMADO", "SALDADO", "JUGADO"];

const hm = (t: string) => (t.startsWith("24") ? "24:00" : t.slice(0, 5));

function aClub(f: FilaClub): Club {
  const canchas: Cancha[] = [...f.courts]
    .filter((c) => c.activa)
    .sort((a, b) => a.orden - b.orden)
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      deporte: c.deporte,
      tipo: c.tipo ?? "",
      techada: c.techada,
      grilla: c.court_schedules.map<Franja>((s) => ({
        dias: [s.dia_semana],
        desde: hm(s.hora_desde),
        hasta: hm(s.hora_hasta),
        duracionMin: s.duracion_min,
        precio: Number(s.precio),
      })),
    }));
  const fotos = [...f.club_photos].sort((a, b) => a.orden - b.orden).map((p) => p.url);
  const deportes = [...new Set(canchas.map((c) => c.deporte))];
  return {
    id: f.id,
    slug: f.slug,
    nombre: f.nombre,
    descripcion: f.descripcion ?? "",
    direccion: f.direccion ?? "",
    barrio: f.barrio ?? "",
    whatsapp: f.whatsapp ?? "",
    deportes: deportes.length ? deportes : ["FUTBOL"],
    rating: Number(f.rating_promedio),
    ratingCantidad: f.rating_cantidad,
    destacado: !!f.destacado_hasta && f.destacado_hasta >= fechaAR(new Date()),
    portada: f.portada_url ?? fotos[0] ?? "",
    fotos,
    servicios: f.servicios ?? [],
    horario: f.horario_atencion ?? "",
    aceptaMercadoPago: f.acepta_mercado_pago,
    aceptaTransferencia: f.acepta_transferencia,
    reglas: {
      plazoPagoHoras: f.plazo_pago_horas,
      corteHoras: f.corte_horas,
      plazoUmHoras: f.plazo_um_horas,
      senaPct: Number(f.sena_pct),
      descuentoUmPct: Number(f.descuento_um_pct),
      permiteDesafios: f.permite_desafios,
    },
    canchas,
  };
}

// ---------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------
export async function obtenerClubes(deporte?: Deporte): Promise<Club[]> {
  let lista: Club[];
  if (supabaseConfigurado) {
    const { data, error } = await (await crearClienteServidor())
      .from("clubs").select(SELECT_CLUB).eq("estado", "ACTIVO");
    if (error) throw new Error(`No se pudieron leer los clubes: ${error.message}`);
    lista = (data as FilaClub[]).map(aClub);
  } else {
    lista = CLUBES;
  }
  if (deporte) lista = lista.filter((c) => c.deportes.includes(deporte));
  return [...lista].sort(
    (a, b) => Number(b.destacado) - Number(a.destacado) || (a.distanciaKm ?? 99) - (b.distanciaKm ?? 99) || a.nombre.localeCompare(b.nombre),
  );
}

export async function obtenerClub(slug: string): Promise<Club | undefined> {
  if (!supabaseConfigurado) return CLUBES.find((c) => c.slug === slug);
  const { data, error } = await (await crearClienteServidor())
    .from("clubs").select(SELECT_CLUB).eq("slug", slug).maybeSingle();
  if (error) throw new Error(`No se pudo leer el club: ${error.message}`);
  return data ? aClub(data as FilaClub) : undefined;
}

const SLIDE_BASE = PUBLICIDADES[0];

export async function obtenerPublicidades(): Promise<Publicidad[]> {
  if (!supabaseConfigurado) return PUBLICIDADES;
  const { data } = await (await crearClienteServidor()).from("ads").select("*").order("orden");
  const ads = (data ?? []).map<Publicidad>((a) => ({
    id: a.id,
    etiqueta: a.cliente ? "Publicidad" : "JugáYa",
    titulo: a.titulo,
    destacado: "",
    texto: a.texto ?? "",
    boton: a.boton_texto ?? "Ver más",
    link: a.link ?? "#clubes",
    imagen: a.imagen_url,
    deporte: "FUTBOL",
  }));
  return ads.length ? ads : [SLIDE_BASE];
}

/** Turnos ocupados (reservas activas) de varios clubes en un rango de fechas. */
async function obtenerOcupacion(clubIds: string[], desde: Date, hasta: Date): Promise<Ocupacion[] | undefined> {
  if (!supabaseConfigurado) return undefined; // modo demo: ocupación simulada
  if (!clubIds.length) return [];
  const { data, error } = await (await crearClienteServidor())
    .from("bookings")
    .select("court_id, inicio, fin, estado, vence_at")
    .in("club_id", clubIds)
    .in("estado", ESTADOS_OCUPADOS)
    .lt("inicio", hasta.toISOString())
    .gt("fin", desde.toISOString());
  if (error) throw new Error(`No se pudo leer la ocupación: ${error.message}`);
  return data as Ocupacion[];
}

/** Próximos `n` días en formato "YYYY-MM-DD" (hora Argentina). */
export function proximosDias(n: number, ahora = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => fechaAR(new Date(ahora.getTime() + i * 86_400_000)));
}

// ---------------------------------------------------------------------
// Generación de la grilla
// ---------------------------------------------------------------------
// Ocupación simulada estable para el modo demo
function azar(semilla: string): number {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) h = Math.imul(h ^ semilla.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

const minutos = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function generarTurnos(club: Club, fecha: string, ahora: Date, ocupacion?: Ocupacion[]): Turno[] {
  const diaSemana = instanteAR(fecha, "12:00").getUTCDay();
  const turnos: Turno[] = [];

  for (const cancha of club.canchas) {
    for (const franja of cancha.grilla.filter((f) => f.dias.includes(diaSemana))) {
      for (let m = minutos(franja.desde); m + franja.duracionMin <= minutos(franja.hasta); m += franja.duracionMin) {
        const inicio = new Date(instanteAR(fecha, "00:00").getTime() + m * 60_000);
        const fin = new Date(inicio.getTime() + franja.duracionMin * 60_000);
        const tipo = tipoPermitido(club.reglas, inicio, ahora);
        const base = {
          canchaId: cancha.id, inicio: inicio.toISOString(), fin: fin.toISOString(), hora: hhmm(m),
          precioLista: franja.precio, precio: franja.precio, descuentoPct: 0,
        };
        const libre = (): Turno =>
          tipo === "ULTIMO_MOMENTO"
            ? { ...base, precio: precioFinal(club.reglas, franja.precio, "ULTIMO_MOMENTO"), descuentoPct: club.reglas.descuentoUmPct, estado: "ULTIMO_MOMENTO" }
            : { ...base, estado: "LIBRE" };

        if (inicio <= ahora) {
          turnos.push({ ...base, estado: "PASADO" });
          continue;
        }

        if (ocupacion) {
          const o = ocupacion.find((x) => x.court_id === cancha.id && new Date(x.inicio) < fin && new Date(x.fin) > inicio);
          if (!o) turnos.push(libre());
          else if (o.estado === "BUSCA_RIVAL") turnos.push({ ...base, estado: "BUSCA_RIVAL" });
          else if (o.estado === "EN_PROCESO")
            turnos.push({ ...base, estado: "EN_PROCESO", quedaTexto: o.vence_at ? tiempoRestante(new Date(o.vence_at).getTime() - ahora.getTime()) : "" });
          else turnos.push({ ...base, estado: "RESERVADO" });
          continue;
        }

        // modo demo
        const r = azar(`${cancha.id}|${inicio.toISOString()}`);
        if (r < 0.3) turnos.push({ ...base, estado: "RESERVADO" });
        else if (tipo === "NORMAL" && r < 0.42) {
          const vence = Math.min(ahora.getTime() + r * 60 * 3_600_000, inicio.getTime() - club.reglas.corteHoras * 3_600_000);
          turnos.push({ ...base, estado: "EN_PROCESO", quedaTexto: tiempoRestante(vence - ahora.getTime()) });
        } else if (tipo === "NORMAL" && r < 0.47 && club.reglas.permiteDesafios) turnos.push({ ...base, estado: "BUSCA_RIVAL" });
        else turnos.push(libre());
      }
    }
  }
  return turnos;
}

/** Turnos de un club para varios días, con su estado (libre, último momento, en proceso, reservado…). */
export async function obtenerTurnosPorDia(club: Club, dias: string[], ahora = new Date()): Promise<Record<string, Turno[]>> {
  const ocupacion = await obtenerOcupacion([club.id], instanteAR(dias[0], "00:00"), instanteAR(dias.at(-1)!, "23:59"));
  return Object.fromEntries(dias.map((d) => [d, generarTurnos(club, d, ahora, ocupacion)]));
}

/** Turnos de Último momento libres de todos los clubes, los más próximos primero. */
export async function obtenerUltimoMomento(clubes: Club[], limite = 10, ahora = new Date()) {
  const dias = proximosDias(4, ahora);
  const ocupacion = await obtenerOcupacion(clubes.map((c) => c.id), ahora, instanteAR(dias.at(-1)!, "23:59"));
  const res: { club: Club; turno: Turno }[] = [];
  for (const club of clubes) {
    for (const fecha of dias) {
      for (const turno of generarTurnos(club, fecha, ahora, ocupacion)) {
        if (turno.estado === "ULTIMO_MOMENTO") res.push({ club, turno });
      }
    }
  }
  // un par por club para que haya variedad
  const porClub = new Map<string, number>();
  return res
    .sort((a, b) => a.turno.inicio.localeCompare(b.turno.inicio))
    .filter(({ club }) => {
      const n = porClub.get(club.id) ?? 0;
      porClub.set(club.id, n + 1);
      return n < 2;
    })
    .slice(0, limite);
}
