import { supabaseConfigurado } from "./supabase/config";
import { crearClienteServidor } from "./supabase/servidor";

export type Usuario = { id: string; email: string; nombre?: string; avatar?: string; esRoot: boolean };

/** Usuario conectado (o null). `esRoot` sale de la base, no del navegador. */
export async function usuarioActual(): Promise<Usuario | null> {
  if (!supabaseConfigurado) return null;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  const meta = (c.user_metadata ?? {}) as Record<string, string | undefined>;
  const { data: perfil } = await supabase.from("profiles").select("es_root").eq("id", c.sub).maybeSingle();
  return {
    id: c.sub,
    email: String(c.email ?? ""),
    nombre: meta.full_name,
    avatar: meta.avatar_url,
    esRoot: perfil?.es_root === true,
  };
}
