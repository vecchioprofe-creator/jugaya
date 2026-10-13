// Datos de demostración hasta conectar Supabase. Nombres ficticios.
import type { Club, Franja, Publicidad, ReglasClub } from "./tipos";

const U = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=70`;
const IMG = {
  futbol: [U("photo-1529900748604-07564a03e7a6"), U("photo-1574629810360-7efbbe195018"), U("photo-1431324155629-1a6deb1dec8d"), U("photo-1551958219-acbc608c6377")],
  padel: [U("photo-1612534847738-b3af9bc31f0c"), U("photo-1626224583764-f87db24ac4ea")],
  tenis: [U("photo-1554068865-24cecd4e34b8"), U("photo-1595435934249-5df7ed86e1c0")],
  basquet: [U("photo-1546519638-68e109498ffc"), U("photo-1505666287802-931dc83948e9")],
  voley: [U("photo-1612872087720-bb876e2e67d1")],
};

const REGLAS: ReglasClub = {
  plazoPagoHoras: 72,
  corteHoras: 72,
  plazoUmHoras: 24,
  senaPct: 50,
  descuentoUmPct: 20,
  permiteDesafios: true,
};
const TODOS = [0, 1, 2, 3, 4, 5, 6];
const noche = (precio: number, duracionMin = 60): Franja[] => [
  { dias: TODOS, desde: "17:00", hasta: "24:00", duracionMin, precio },
];

const SERVICIOS = ["🚿 Vestuarios", "🅿️ Estacionamiento", "🍔 Buffet", "🔥 Parrilla", "💡 Luz LED", "📶 Wi-Fi"];

export const CLUBES: Club[] = [
  {
    id: "c1", slug: "complejo-el-potrero", nombre: "Complejo El Potrero",
    descripcion: "Canchas de césped sintético de última generación, iluminación LED, vestuarios con agua caliente y quincho para el tercer tiempo.",
    direccion: "Av. Mitre 1450", barrio: "Avellaneda", distanciaKm: 1.2, whatsapp: "5491140000001",
    deportes: ["FUTBOL"], rating: 4.8, ratingCantidad: 212, destacado: true,
    portada: IMG.futbol[0], fotos: [...IMG.futbol], servicios: SERVICIOS, horario: "Lun a Dom · 9 a 01 hs",
    aceptaMercadoPago: true, aceptaTransferencia: true, reglas: REGLAS,
    canchas: [
      { id: "c1a", nombre: "Cancha 1", deporte: "FUTBOL", tipo: "F5 sintético", techada: false, grilla: noche(60000) },
      { id: "c1b", nombre: "Cancha 2", deporte: "FUTBOL", tipo: "F5 sintético", techada: false, grilla: noche(60000) },
      { id: "c1c", nombre: "Cancha 3", deporte: "FUTBOL", tipo: "F7 sintético", techada: false, grilla: noche(84000) },
    ],
  },
  {
    id: "c2", slug: "padel-box-palermo", nombre: "Pádel Box Palermo",
    descripcion: "Seis canchas de blindex con césped premium, bar y tienda de paletas.",
    direccion: "Godoy Cruz 2340", barrio: "Palermo", distanciaKm: 3.4, whatsapp: "5491140000002",
    deportes: ["PADEL"], rating: 4.9, ratingCantidad: 340, destacado: true,
    portada: IMG.padel[0], fotos: [...IMG.padel, IMG.tenis[1]], servicios: SERVICIOS.slice(0, 4), horario: "Todos los días · 8 a 24 hs",
    aceptaMercadoPago: true, aceptaTransferencia: false, reglas: { ...REGLAS, descuentoUmPct: 30 },
    canchas: [
      { id: "c2a", nombre: "Cancha 1", deporte: "PADEL", tipo: "Blindex", techada: true, grilla: noche(30000, 90) },
      { id: "c2b", nombre: "Cancha 2", deporte: "PADEL", tipo: "Blindex", techada: true, grilla: noche(30000, 90) },
      { id: "c2c", nombre: "Cancha 3", deporte: "PADEL", tipo: "Blindex", techada: false, grilla: noche(26000, 90) },
    ],
  },
  {
    id: "c3", slug: "atletico-villa-verde", nombre: "Club Atlético Villa Verde",
    descripcion: "Club de barrio con fútbol 5 techado y buffet familiar.",
    direccion: "Calle 12 nº 880", barrio: "Quilmes", distanciaKm: 6.1, whatsapp: "5491140000003",
    deportes: ["FUTBOL"], rating: 4.5, ratingCantidad: 98, destacado: false,
    portada: IMG.futbol[1], fotos: IMG.futbol.slice(1), servicios: SERVICIOS.slice(0, 3), horario: "Lun a Sáb · 16 a 24 hs",
    aceptaMercadoPago: false, aceptaTransferencia: true, reglas: { ...REGLAS, senaPct: 40 },
    canchas: [
      { id: "c3a", nombre: "Cancha techada", deporte: "FUTBOL", tipo: "F5 techado", techada: true, grilla: noche(55000) },
    ],
  },
  {
    id: "c4", slug: "tenis-parque-sur", nombre: "Tenis Parque Sur",
    descripcion: "Canchas de polvo de ladrillo y cemento, clases y alquiler de raquetas.",
    direccion: "Av. Roca 3100", barrio: "Parque Patricios", distanciaKm: 4.8, whatsapp: "5491140000004",
    deportes: ["TENIS"], rating: 4.6, ratingCantidad: 77, destacado: false,
    portada: IMG.tenis[0], fotos: IMG.tenis, servicios: SERVICIOS.slice(0, 2), horario: "Todos los días · 7 a 23 hs",
    aceptaMercadoPago: true, aceptaTransferencia: true, reglas: REGLAS,
    canchas: [
      { id: "c4a", nombre: "Cancha 1", deporte: "TENIS", tipo: "Polvo de ladrillo", techada: false, grilla: noche(24000) },
      { id: "c4b", nombre: "Cancha 2", deporte: "TENIS", tipo: "Cemento", techada: false, grilla: noche(20000) },
    ],
  },
  {
    id: "c5", slug: "dunk-house", nombre: "Dunk House",
    descripcion: "Parquet profesional, tableros reglamentarios y media cancha para 3x3.",
    direccion: "Thames 900", barrio: "Villa Crespo", distanciaKm: 3.9, whatsapp: "5491140000005",
    deportes: ["BASQUET"], rating: 4.7, ratingCantidad: 65, destacado: false,
    portada: IMG.basquet[0], fotos: IMG.basquet, servicios: SERVICIOS.slice(0, 2), horario: "Lun a Dom · 10 a 24 hs",
    aceptaMercadoPago: true, aceptaTransferencia: false, reglas: REGLAS,
    canchas: [
      { id: "c5a", nombre: "Cancha principal", deporte: "BASQUET", tipo: "Parquet", techada: true, grilla: noche(70000) },
      { id: "c5b", nombre: "Media cancha 3x3", deporte: "BASQUET", tipo: "Parquet", techada: true, grilla: noche(40000) },
    ],
  },
  {
    id: "c6", slug: "la-quinta-f5", nombre: "La Quinta F5",
    descripcion: "Predio con fútbol 5 y 8, quincho con parrilla y pileta en verano.",
    direccion: "Ruta 205 km 4", barrio: "Ezeiza", distanciaKm: 9.5, whatsapp: "5491140000006",
    deportes: ["FUTBOL"], rating: 4.4, ratingCantidad: 51, destacado: false,
    portada: IMG.futbol[2], fotos: IMG.futbol, servicios: SERVICIOS, horario: "Vie a Dom · 10 a 24 hs",
    aceptaMercadoPago: true, aceptaTransferencia: true, reglas: { ...REGLAS, descuentoUmPct: 25 },
    canchas: [
      { id: "c6a", nombre: "Cancha 1", deporte: "FUTBOL", tipo: "F8 sintético", techada: false, grilla: noche(80000) },
      { id: "c6b", nombre: "Cancha 2", deporte: "FUTBOL", tipo: "F5 sintético", techada: false, grilla: noche(55000) },
    ],
  },
  {
    id: "c7", slug: "smash-padel-norte", nombre: "Smash Pádel Norte",
    descripcion: "Cuatro canchas panorámicas y bar con vista.",
    direccion: "Av. Maipú 2200", barrio: "Olivos", distanciaKm: 11, whatsapp: "5491140000007",
    deportes: ["PADEL"], rating: 4.8, ratingCantidad: 189, destacado: false,
    portada: IMG.padel[1], fotos: IMG.padel, servicios: SERVICIOS.slice(1, 5), horario: "Todos los días · 8 a 24 hs",
    aceptaMercadoPago: true, aceptaTransferencia: true, reglas: REGLAS,
    canchas: [
      { id: "c7a", nombre: "Panorámica 1", deporte: "PADEL", tipo: "Panorámica", techada: true, grilla: noche(32000, 90) },
      { id: "c7b", nombre: "Panorámica 2", deporte: "PADEL", tipo: "Panorámica", techada: true, grilla: noche(32000, 90) },
    ],
  },
  {
    id: "c8", slug: "arena-voley-costanera", nombre: "Arena Vóley Costanera",
    descripcion: "Beach vóley frente al río, con duchas y alquiler de pelotas.",
    direccion: "Av. Costanera 400", barrio: "Costanera Sur", distanciaKm: 5.2, whatsapp: "5491140000008",
    deportes: ["VOLEY"], rating: 4.5, ratingCantidad: 33, destacado: false,
    portada: IMG.voley[0], fotos: IMG.voley, servicios: SERVICIOS.slice(0, 2), horario: "Mar a Dom · 10 a 22 hs",
    aceptaMercadoPago: true, aceptaTransferencia: false, reglas: REGLAS,
    canchas: [
      { id: "c8a", nombre: "Arena 1", deporte: "VOLEY", tipo: "Arena", techada: false, grilla: noche(28000) },
    ],
  },
];

export const PUBLICIDADES: Publicidad[] = [
  { id: "a1", etiqueta: "JugáYa", titulo: "Jugá hoy.", destacado: "Pagá entre todos.", texto: "Reservá tu cancha, armá el grupo y que cada uno pague su parte desde un link.", boton: "Buscar turnos", link: "#clubes", imagen: IMG.futbol[1], deporte: "FUTBOL" },
  { id: "a2", etiqueta: "Publicidad", titulo: "Pádel Box:", destacado: "2x1 de lunes a jueves", texto: "Turnos de 14 a 17 hs con 50% off, solo reservando por JugáYa.", boton: "Ver club", link: "/club/padel-box-palermo", imagen: IMG.padel[0], deporte: "PADEL" },
  { id: "a3", etiqueta: "Último momento", titulo: "Turnos con", destacado: "descuento hoy", texto: "Las canchas libres de los próximos días, más baratas. La seña se paga en 24 h.", boton: "Ver ofertas", link: "#ultimo-momento", imagen: IMG.futbol[2], deporte: "FUTBOL" },
];
