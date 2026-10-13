import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/** Google → Supabase → acá: canjea el código por la sesión y vuelve a donde estaba el usuario. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const siguiente = searchParams.get("next") ?? "/";
  // solo rutas internas (evita redirecciones a otros sitios)
  const destino = siguiente.startsWith("/") && !siguiente.startsWith("//") ? siguiente : "/";

  if (code) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }
  return NextResponse.redirect(`${origin}/?error=login`);
}
