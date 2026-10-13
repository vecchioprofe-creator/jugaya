"use client";

import { useActionState, useEffect, useRef } from "react";
import { crearClub, type EstadoFormulario } from "./acciones";

const campo = "w-full rounded-xl border border-line bg-bg2 px-3 py-2.5 text-[15px] outline-none focus:border-accent";

export function FormCrearClub() {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(crearClub, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);

  return (
    <form ref={form} action={enviar} className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="text-sm text-muted">Nombre del club o sede *</span>
        <input name="nombre" required className={campo} placeholder="Complejo El Potrero" />
      </label>
      <label>
        <span className="text-sm text-muted">Gmail del dueño *</span>
        <input name="email" type="email" required className={campo} placeholder="dueño@gmail.com" />
      </label>
      <label>
        <span className="text-sm text-muted">WhatsApp del club</span>
        <input name="whatsapp" className={campo} placeholder="5491140000000" />
      </label>
      <label>
        <span className="text-sm text-muted">Dirección</span>
        <input name="direccion" className={campo} placeholder="Av. Mitre 1450" />
      </label>
      <label>
        <span className="text-sm text-muted">Barrio / localidad</span>
        <input name="barrio" className={campo} placeholder="Avellaneda" />
      </label>
      <label>
        <span className="text-sm text-muted">Plan</span>
        <select name="plan" className={campo} defaultValue="Básico">
          <option>Básico</option>
          <option>Pro</option>
          <option>Premium</option>
        </select>
      </label>
      <label>
        <span className="text-sm text-muted">Suscripción mensual ($)</span>
        <input name="monto" type="number" min="0" step="500" className={campo} placeholder="20000" />
      </label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          disabled={enviando}
          className="rounded-xl bg-accent px-5 py-3 font-bold text-[#0b0f05] transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {enviando ? "Creando…" : "+ Crear club"}
        </button>
        {estado.error && <p className="text-sm font-semibold text-hot">⚠️ {estado.error}</p>}
        {estado.ok && <p className="text-sm font-semibold text-ok">✔ {estado.ok}</p>}
      </div>
    </form>
  );
}
