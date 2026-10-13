import type { Deporte } from "./tipos";

export const DEPORTES: Record<Deporte, { nombre: string; icono: string; degradado: string }> = {
  FUTBOL: { nombre: "Fútbol", icono: "⚽", degradado: "linear-gradient(135deg,#14532d,#0b0f05)" },
  PADEL: { nombre: "Pádel", icono: "🎾", degradado: "linear-gradient(135deg,#1e3a8a,#0b0f1a)" },
  TENIS: { nombre: "Tenis", icono: "🥎", degradado: "linear-gradient(135deg,#9a3412,#1a0b05)" },
  BASQUET: { nombre: "Básquet", icono: "🏀", degradado: "linear-gradient(135deg,#7c2d12,#150a05)" },
  VOLEY: { nombre: "Vóley", icono: "🏐", degradado: "linear-gradient(135deg,#6b21a8,#0f0517)" },
};

/** Fondo de foto con degradado de respaldo si la imagen no carga. */
export const fondo = (url: string, deporte: Deporte) => ({
  backgroundImage: `url('${url}'), ${DEPORTES[deporte].degradado}`,
});
