"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type Resultado = { error?: string; ok?: string };

// Permisos y reglas (solo el admin edita, montos máximos, plazos) los aplica la base.
async function rpc(codigo: string, fn: string, args: Record<string, unknown>, ok: string): Promise<Resultado> {
  const { error } = await (await crearClienteServidor()).rpc(fn, args);
  if (error) return { error: error.message };
  revalidatePath(`/g/${codigo}`);
  return { ok };
}

/** El comprobante ya lo subió el navegador a Storage; acá se informa el pago. */
export async function informarTransferencia(codigo: string, jugadorId: string, monto: number, comprobante: string) {
  return rpc(codigo, "informar_transferencia", { p_player: jugadorId, p_monto: monto, p_comprobante: comprobante },
    "¡Listo! Recibimos tu comprobante. El club lo revisa y se suma al total.");
}

export async function renombrarJugador(codigo: string, jugadorId: string, nombre: string) {
  const n = nombre.trim().slice(0, 40);
  if (!n) return { error: "El nombre no puede quedar vacío." };
  return rpc(codigo, "renombrar_jugador", { p_player: jugadorId, p_nombre: n }, "Nombre actualizado");
}

export async function eliminarJugador(codigo: string, jugadorId: string) {
  return rpc(codigo, "eliminar_jugador", { p_player: jugadorId }, "Jugador eliminado");
}

export async function agregarJugador(codigo: string, equipoId: string, nombre: string) {
  const n = nombre.trim().slice(0, 40);
  if (!n) return { error: "Escribí el nombre o apodo." };
  return rpc(codigo, "agregar_jugador", { p_team: equipoId, p_nombre: n }, "Jugador agregado");
}
