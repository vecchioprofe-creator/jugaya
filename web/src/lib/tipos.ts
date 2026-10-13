export type Deporte = "FUTBOL" | "PADEL" | "TENIS" | "BASQUET" | "VOLEY";

/** Reglas configurables por club (PLAN.md §4.2). Espejo de las columnas de `clubs`. */
export type ReglasClub = {
  plazoPagoHoras: number; // P
  corteHoras: number; // C
  plazoUmHoras: number; // U
  senaPct: number;
  descuentoUmPct: number;
  permiteDesafios: boolean;
};

export type Franja = {
  dias: number[]; // 0 = domingo
  desde: string; // "17:00"
  hasta: string; // "24:00"
  duracionMin: number;
  precio: number;
};

export type Cancha = {
  id: string;
  nombre: string;
  deporte: Deporte;
  tipo: string;
  techada: boolean;
  grilla: Franja[];
};

export type Club = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  direccion: string;
  barrio: string;
  distanciaKm: number;
  whatsapp: string;
  deportes: Deporte[];
  rating: number;
  ratingCantidad: number;
  destacado: boolean;
  portada: string;
  fotos: string[];
  servicios: string[];
  horario: string;
  aceptaMercadoPago: boolean;
  aceptaTransferencia: boolean;
  reglas: ReglasClub;
  canchas: Cancha[];
};

export type TipoReserva = "NORMAL" | "DESAFIO" | "ULTIMO_MOMENTO";

export type EstadoTurno =
  | "LIBRE"
  | "ULTIMO_MOMENTO"
  | "EN_PROCESO"
  | "BUSCA_RIVAL"
  | "RESERVADO"
  | "PASADO";

export type Turno = {
  canchaId: string;
  inicio: string; // ISO
  fin: string;
  hora: string; // "21:00" (hora Argentina)
  precioLista: number;
  precio: number;
  descuentoPct: number;
  estado: EstadoTurno;
  quedaTexto?: string; // "2 d 5 h" para turnos en proceso
};

export type Publicidad = {
  id: string;
  etiqueta: string;
  titulo: string;
  destacado: string;
  texto: string;
  boton: string;
  link: string;
  imagen: string;
  deporte: Deporte;
};
