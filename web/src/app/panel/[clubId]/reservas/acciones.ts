"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type Resultado = { error?: string; ok?: string };

// La base verifica que quien llama sea del club (dueño o empleado) o root.
export async function revisarPago(clubId: string, pagoId: string, aprobar: boolean, motivo?: string): Promise<Resultado> {
  const { data, error } = await (await crearClienteServidor())
    .rpc("revisar_pago", { p_payment: pagoId, p_aprobar: aprobar, p_motivo: motivo ?? null });
  if (error) return { error: error.message };
  revalidatePath(`/panel/${clubId}/reservas`);
  if (!aprobar) return { ok: "Comprobante rechazado" };
  return { ok: data === "CONFIRMADO" ? "Aprobado ✔ ¡La reserva quedó confirmada!" : data === "SALDADO" ? "Aprobado ✔ Reserva saldada" : "Aprobado ✔" };
}

export async function cobrarEnClub(clubId: string, reservaId: string, monto: number): Promise<Resultado> {
  if (!(monto > 0)) return { error: "Escribí el monto cobrado." };
  const { error } = await (await crearClienteServidor()).rpc("registrar_cobro_club", { p_booking: reservaId, p_monto: monto });
  if (error) return { error: error.message };
  revalidatePath(`/panel/${clubId}/reservas`);
  return { ok: "Cobro registrado ✔" };
}
