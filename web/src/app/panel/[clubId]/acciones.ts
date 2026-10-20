"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// La seguridad la garantiza la base (RLS + disparadores): un usuario que no es
// dueño del club no puede modificarlo aunque llame a estas acciones.

export type EstadoFormulario = { error?: string; ok?: string };

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim() || null;
const numero = (fd: FormData, campo: string) => {
  const n = Number(fd.get(campo));
  return Number.isFinite(n) ? n : NaN;
};
const refrescar = (clubId: string) => revalidatePath(`/panel/${clubId}`);

/** update que falla si no modificó nada (RLS lo filtró = sin permiso). */
async function actualizarClub(clubId: string, cambios: Record<string, unknown>): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("clubs").update(cambios).eq("id", clubId).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "No tenés permiso para modificar este club." };
  refrescar(clubId);
  return { ok: "Guardado ✔" };
}

export async function guardarDatos(clubId: string, _p: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  return actualizarClub(clubId, {
    descripcion: texto(fd, "descripcion"),
    direccion: texto(fd, "direccion"),
    barrio: texto(fd, "barrio"),
    whatsapp: texto(fd, "whatsapp")?.replace(/\D/g, "") || null,
    horario_atencion: texto(fd, "horario"),
    servicios: fd.getAll("servicios").map(String),
  });
}

export async function guardarReglas(clubId: string, _p: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const r = {
    sena_pct: numero(fd, "sena"),
    plazo_pago_horas: numero(fd, "plazoPago"),
    corte_horas: Math.round(numero(fd, "corteDias") * 24),
    plazo_um_horas: numero(fd, "plazoUm"),
    descuento_um_pct: numero(fd, "descuento"),
    permite_desafios: fd.get("desafios") === "on",
  };
  if (Object.values(r).some((v) => typeof v === "number" && (Number.isNaN(v) || v < 0)))
    return { error: "Revisá los valores: tienen que ser números positivos." };
  if (r.plazo_um_horas > r.corte_horas)
    return { error: "El plazo de Último momento no puede ser mayor que el corte antes del partido." };
  return actualizarClub(clubId, r);
}

export async function guardarCobros(clubId: string, _p: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  return actualizarClub(clubId, {
    acepta_transferencia: fd.get("transferencia") === "on",
    transferencia_alias: texto(fd, "alias"),
    transferencia_cbu: texto(fd, "cbu")?.replace(/\s/g, "") || null,
    transferencia_titular: texto(fd, "titular"),
  });
}

export async function publicarClub(clubId: string): Promise<EstadoFormulario> {
  const r = await actualizarClub(clubId, { estado: "ACTIVO" });
  return r.ok ? { ok: "¡Tu club ya está publicado! 🎉" } : r;
}

// ---------------------------------------------------------------------
// Canchas y horarios
// ---------------------------------------------------------------------
const DEPORTES = ["FUTBOL", "PADEL", "TENIS", "BASQUET", "VOLEY"];

export async function crearCancha(clubId: string, _p: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const nombre = texto(fd, "nombre");
  const deporte = String(fd.get("deporte"));
  if (!nombre) return { error: "Poné un nombre a la cancha (ej: Cancha 1)." };
  if (!DEPORTES.includes(deporte)) return { error: "Elegí un deporte." };
  const supabase = await crearClienteServidor();
  const { count } = await supabase.from("courts").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  const { error } = await supabase.from("courts").insert({
    club_id: clubId,
    nombre,
    deporte,
    tipo: texto(fd, "tipo"),
    techada: fd.get("techada") === "on",
    orden: (count ?? 0) + 1,
  });
  if (error) return { error: error.message.includes("row-level security") ? "No tenés permiso para este club." : error.message };
  refrescar(clubId);
  return { ok: `"${nombre}" agregada. Ahora cargale los horarios.` };
}

export async function actualizarCancha(clubId: string, canchaId: string, cambios: { nombre?: string; tipo?: string; techada?: boolean; activa?: boolean }) {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("courts").update(cambios).eq("id", canchaId).eq("club_id", clubId).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "No tenés permiso para modificar esta cancha." };
  refrescar(clubId);
  return { ok: "Guardado ✔" };
}

export type FranjaForm = { dias: number[]; desde: string; hasta: string; duracion: number; precio: number };

export async function guardarHorarios(clubId: string, canchaId: string, franjas: FranjaForm[]): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("guardar_horarios", { p_court: canchaId, p_franjas: franjas });
  if (error) return { error: error.message };
  refrescar(clubId);
  return { ok: "Horarios guardados ✔" };
}

// ---------------------------------------------------------------------
// Fotos (el archivo lo sube el navegador directo a Storage; acá se registra)
// ---------------------------------------------------------------------
export async function registrarFoto(clubId: string, url: string): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  const { count } = await supabase.from("club_photos").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  const { error } = await supabase.from("club_photos").insert({ club_id: clubId, url, orden: (count ?? 0) + 1 });
  if (error) return { error: error.message };
  // la primera foto pasa a ser la portada
  if (!count) await supabase.from("clubs").update({ portada_url: url }).eq("id", clubId).is("portada_url", null);
  refrescar(clubId);
  return { ok: "Foto agregada ✔" };
}

export async function borrarFoto(clubId: string, fotoId: string, url: string): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("club_photos").delete().eq("id", fotoId).eq("club_id", clubId).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "No tenés permiso para borrar esta foto." };
  const ruta = url.split("/club-fotos/")[1];
  if (ruta) await supabase.storage.from("club-fotos").remove([decodeURIComponent(ruta)]);
  await supabase.from("clubs").update({ portada_url: null }).eq("id", clubId).eq("portada_url", url);
  refrescar(clubId);
  return { ok: "Foto borrada" };
}

export async function elegirPortada(clubId: string, url: string): Promise<EstadoFormulario> {
  return actualizarClub(clubId, { portada_url: url });
}
