// Reglas de tiempo y precio (PLAN.md §3.1.b).
// La fuente de verdad es la base (supabase/migrations: tipo_permitido, calcular_vencimiento,
// crear_reserva); esto es el mismo cálculo para mostrarlo en pantalla antes de reservar.
import type { ReglasClub, TipoReserva } from "./tipos";

const HORA = 3_600_000;
export const ZONA = "America/Argentina/Buenos_Aires";

/** Con más de C de anticipación es reserva normal (o desafío); si no, Último momento. */
export function tipoPermitido(r: ReglasClub, inicio: Date, ahora = new Date()): "NORMAL" | "ULTIMO_MOMENTO" {
  return inicio.getTime() - ahora.getTime() > r.corteHoras * HORA ? "NORMAL" : "ULTIMO_MOMENTO";
}

export function calcularVencimiento(r: ReglasClub, tipo: TipoReserva, inicio: Date, ahora = new Date()): Date {
  const corte = inicio.getTime() - r.corteHoras * HORA;
  switch (tipo) {
    case "DESAFIO":
      return new Date(corte);
    case "NORMAL":
      return new Date(Math.min(ahora.getTime() + r.plazoPagoHoras * HORA, corte));
    case "ULTIMO_MOMENTO":
      return new Date(Math.min(ahora.getTime() + r.plazoUmHoras * HORA, inicio.getTime()));
  }
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function precioFinal(r: ReglasClub, precioLista: number, tipo: TipoReserva): number {
  return tipo === "ULTIMO_MOMENTO" ? redondear(precioLista * (1 - r.descuentoUmPct / 100)) : precioLista;
}

/** La seña se calcula sobre el precio final (con descuento si corresponde). */
export function senaMinima(r: ReglasClub, precio: number): number {
  return redondear((precio * r.senaPct) / 100);
}

export function plata(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

export function tiempoRestante(ms: number): string {
  if (ms <= 0) return "vencido";
  const h = Math.floor(ms / HORA);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} d ${h % 24} h`;
  const m = Math.floor((ms % HORA) / 60_000);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export function fechaHora(d: Date): string {
  return d.toLocaleString("es-AR", {
    timeZone: ZONA,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** 72 → "3 días", 36 → "36 h" */
export function horasTexto(h: number): string {
  if (h % 24 !== 0) return `${h} h`;
  return h === 24 ? "24 h" : `${h / 24} días`;
}

/** "YYYY-MM-DD" en hora Argentina. */
export function fechaAR(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: ZONA });
}

/** Argentina no usa horario de verano: UTC-3 fijo. */
export function instanteAR(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00-03:00`);
}
