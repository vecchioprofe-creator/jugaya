"use server";

import { usuarioActual } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type ResultadoReserva = { error?: string; codigo?: string };

/** Crea la reserva y el grupo (las reglas de plazos, precios y superposición las aplica la base). */
export async function reservar(entrada: {
  canchaId: string;
  inicio: string;
  jugadores: string[];
  whatsapp: string;
}): Promise<ResultadoReserva> {
  const usuario = await usuarioActual();
  if (!usuario) return { error: "Ingresá con Google para reservar." };

  const jugadores = entrada.jugadores.map((j, i) => j.trim().slice(0, 40) || `Jugador ${i + 1}`);
  if (jugadores.length < 2 || jugadores.length > 30) return { error: "La lista tiene que tener entre 2 y 30 jugadores." };

  const whatsapp = entrada.whatsapp.replace(/\D/g, "");
  if (whatsapp.length < 8) return { error: "Poné tu WhatsApp (con código de área) para que el grupo y el club te puedan contactar." };

  const supabase = await crearClienteServidor();
  if (whatsapp !== usuario.whatsapp) {
    await supabase.from("profiles").update({ whatsapp }).eq("id", usuario.id);
  }

  const { data, error } = await supabase.rpc("crear_reserva", {
    p_court: entrada.canchaId,
    p_inicio: entrada.inicio,
    p_desafio: false, // los desafíos se habilitan con el tablero de Solicitudes
    p_jugadores: jugadores,
    p_equipo: null,
    p_whatsapp: whatsapp,
  });
  if (error) return { error: error.message };
  return { codigo: (data as { codigo: string }).codigo };
}
