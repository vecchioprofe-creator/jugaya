// Capa de acceso a datos. Hoy responde con datos de demostración;
// al conectar Supabase se reemplaza el cuerpo de cada función sin tocar las pantallas.
import { CLUBES, PUBLICIDADES } from "./demo";
import { fechaAR, instanteAR, precioFinal, tiempoRestante, tipoPermitido } from "./reglas";
import type { Club, Deporte, Turno } from "./tipos";

export async function obtenerClubes(deporte?: Deporte): Promise<Club[]> {
  const lista = deporte ? CLUBES.filter((c) => c.deportes.includes(deporte)) : CLUBES;
  return [...lista].sort((a, b) => Number(b.destacado) - Number(a.destacado) || a.distanciaKm - b.distanciaKm);
}

export async function obtenerClub(slug: string): Promise<Club | undefined> {
  return CLUBES.find((c) => c.slug === slug);
}

export async function obtenerPublicidades() {
  return PUBLICIDADES;
}

/** Próximos `n` días en formato "YYYY-MM-DD" (hora Argentina). */
export function proximosDias(n: number, ahora = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => fechaAR(new Date(ahora.getTime() + i * 86_400_000)));
}

// Ocupación simulada estable (mismo resultado para el mismo turno en cada carga)
function azar(semilla: string): number {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) h = Math.imul(h ^ semilla.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Turnos de un club para un día, con su estado (libre, último momento, en proceso, reservado…). */
export async function obtenerTurnos(club: Club, fecha: string, ahora = new Date()): Promise<Turno[]> {
  const diaSemana = instanteAR(fecha, "12:00").getUTCDay();
  const turnos: Turno[] = [];

  for (const cancha of club.canchas) {
    for (const franja of cancha.grilla.filter((f) => f.dias.includes(diaSemana))) {
      for (let m = minutos(franja.desde); m + franja.duracionMin <= minutos(franja.hasta); m += franja.duracionMin) {
        const inicio = new Date(instanteAR(fecha, "00:00").getTime() + m * 60_000);
        const fin = new Date(inicio.getTime() + franja.duracionMin * 60_000);
        const tipo = tipoPermitido(club.reglas, inicio, ahora);
        const r = azar(`${cancha.id}|${inicio.toISOString()}`);
        const base = { canchaId: cancha.id, inicio: inicio.toISOString(), fin: fin.toISOString(), hora: hhmm(m), precioLista: franja.precio };

        if (inicio <= ahora) {
          turnos.push({ ...base, precio: franja.precio, descuentoPct: 0, estado: "PASADO" });
        } else if (r < 0.3) {
          turnos.push({ ...base, precio: franja.precio, descuentoPct: 0, estado: "RESERVADO" });
        } else if (tipo === "NORMAL" && r < 0.42) {
          const vence = Math.min(ahora.getTime() + r * 60 * 3_600_000, inicio.getTime() - club.reglas.corteHoras * 3_600_000);
          turnos.push({ ...base, precio: franja.precio, descuentoPct: 0, estado: "EN_PROCESO", quedaTexto: tiempoRestante(vence - ahora.getTime()) });
        } else if (tipo === "NORMAL" && r < 0.47 && club.reglas.permiteDesafios) {
          turnos.push({ ...base, precio: franja.precio, descuentoPct: 0, estado: "BUSCA_RIVAL" });
        } else if (tipo === "ULTIMO_MOMENTO") {
          turnos.push({ ...base, precio: precioFinal(club.reglas, franja.precio, "ULTIMO_MOMENTO"), descuentoPct: club.reglas.descuentoUmPct, estado: "ULTIMO_MOMENTO" });
        } else {
          turnos.push({ ...base, precio: franja.precio, descuentoPct: 0, estado: "LIBRE" });
        }
      }
    }
  }
  return turnos;
}

/** Turnos de Último momento libres de todos los clubes, los más próximos primero. */
export async function obtenerUltimoMomento(limite = 10, ahora = new Date()) {
  const dias = proximosDias(4, ahora);
  const res: { club: Club; turno: Turno }[] = [];
  for (const club of CLUBES) {
    for (const fecha of dias) {
      for (const turno of await obtenerTurnos(club, fecha, ahora)) {
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
