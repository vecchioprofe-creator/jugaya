"use server";

import { revalidatePath } from "next/cache";
import { fechaAR } from "@/lib/reglas";
import { usuarioActual } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoFormulario = { error?: string; ok?: string };

// La base vuelve a verificar es_root() en cada operación; esto es una primera barrera.
async function clienteRoot() {
  const u = await usuarioActual();
  if (!u?.esRoot) throw new Error("Sin permiso");
  return crearClienteServidor();
}

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim() || null;

export async function crearClub(_previo: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  try {
    const supabase = await clienteRoot();
    const nombre = texto(fd, "nombre");
    const email = texto(fd, "email");
    if (!nombre || !email) return { error: "Completá el nombre del club y el Gmail del dueño." };
    const monto = Number(fd.get("monto") || 0);

    const { error } = await supabase.rpc("crear_club", {
      p_nombre: nombre,
      p_email_duenio: email,
      p_plan: texto(fd, "plan"),
      p_monto: Number.isFinite(monto) ? monto : 0,
      p_direccion: texto(fd, "direccion"),
      p_barrio: texto(fd, "barrio"),
      p_whatsapp: texto(fd, "whatsapp"),
    });
    if (error) return { error: error.message };
    revalidatePath("/root");
    return { ok: `Listo: "${nombre}" creado. Cuando ${email} entre con Google va a poder configurar su club.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo crear el club." };
  }
}

export async function marcarPago(fd: FormData) {
  const supabase = await clienteRoot();
  const pagado = fd.get("pagado") === "true";
  const { error } = await supabase
    .from("subscriptions")
    .update({ pagado, fecha_pago: pagado ? fechaAR(new Date()) : null })
    .eq("id", String(fd.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/root");
}

const ESTADOS = ["PENDIENTE_ACTIVACION", "ACTIVO", "SUSPENDIDO"] as const;

export async function cambiarEstadoClub(fd: FormData) {
  const supabase = await clienteRoot();
  const estado = String(fd.get("estado"));
  if (!ESTADOS.includes(estado as (typeof ESTADOS)[number])) throw new Error("Estado inválido");
  const { error } = await supabase.from("clubs").update({ estado }).eq("id", String(fd.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/root");
  revalidatePath("/");
}
