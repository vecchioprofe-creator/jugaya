"use client";

import { useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

export function BotonIngresar({ habilitado }: { habilitado: boolean }) {
  const [cargando, setCargando] = useState(false);

  async function ingresar() {
    setCargando(true);
    const volverA = window.location.pathname + window.location.search;
    const { error } = await crearClienteNavegador().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(volverA)}` },
    });
    if (error) {
      setCargando(false);
      alert("No se pudo iniciar sesión con Google. Probá de nuevo.");
    }
  }

  return (
    <button
      onClick={ingresar}
      disabled={!habilitado || cargando}
      title={habilitado ? undefined : "Disponible al conectar Supabase"}
      className="flex shrink-0 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100 disabled:opacity-70"
    >
      <span className="font-bold text-[#4285F4]">G</span>
      <span className="hidden sm:inline">{cargando ? "Abriendo Google…" : "Ingresar con Google"}</span>
    </button>
  );
}
