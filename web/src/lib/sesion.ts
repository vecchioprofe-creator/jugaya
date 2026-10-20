import { supabaseConfigurado } from "./supabase/config";
import { crearClienteServidor } from "./supabase/servidor";

export type Usuario = {
  id: string; email: string; nombre?: string; apodo?: string; whatsapp?: string; avatar?: string;
  esRoot: boolean; esDuenio: boolean;
};

/** Usuario conectado (o null). `esRoot` sale de la base, no del navegador. */
export async function usuarioActual(): Promise<Usuario | null> {
  if (!supabaseConfigurado) return null;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  const meta = (c.user_metadata ?? {}) as Record<string, string | undefined>;
  const [{ data: perfil }, { count }] = await Promise.all([
    supabase.from("profiles").select("es_root, apodo, whatsapp").eq("id", c.sub).maybeSingle(),
    supabase.from("club_members").select("club_id", { count: "exact", head: true }).eq("user_id", c.sub).eq("rol", "DUENIO"),
  ]);
  return {
    id: c.sub,
    email: String(c.email ?? ""),
    nombre: meta.full_name,
    apodo: perfil?.apodo ?? undefined,
    whatsapp: perfil?.whatsapp ?? undefined,
    avatar: meta.avatar_url,
    esRoot: perfil?.es_root === true,
    esDuenio: (count ?? 0) > 0,
  };
}
