export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Mientras no se completen las variables de entorno, la web funciona con datos de demostración. */
export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_KEY);
