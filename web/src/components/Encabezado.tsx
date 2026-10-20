import Link from "next/link";
import { usuarioActual } from "@/lib/sesion";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { BotonIngresar } from "./BotonIngresar";

const LINKS = [
  { href: "/", texto: "Inicio" },
  { href: "/#clubes", texto: "Clubes" },
  { href: "/#ultimo-momento", texto: "🔥 Último momento" },
];

export async function Encabezado() {
  const usuario = await usuarioActual();
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-3xl tracking-wide">
          <span className="girar inline-block size-7 rounded-full bg-[radial-gradient(circle_at_30%_30%,#fff,#c6ff3d_60%,#5c7a12)]" />
          <span>
            Jugá<span className="text-accent">Ya</span>
          </span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-[15px] text-muted transition hover:bg-card hover:text-text"
            >
              {l.texto}
            </Link>
          ))}
          {usuario && (
            <Link href="/mis-partidos" className="whitespace-nowrap rounded-lg px-3 py-2 text-[15px] text-muted transition hover:bg-card hover:text-text">
              Mis partidos
            </Link>
          )}
          {usuario?.esDuenio && (
            <Link href="/panel" className="whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-semibold text-accent transition hover:bg-card">
              Mi club
            </Link>
          )}
          {usuario?.esRoot && (
            <Link href="/root" className="whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-semibold text-violet transition hover:bg-card">
              Root
            </Link>
          )}
        </nav>
        {usuario ? (
          <form action="/auth/salir" method="post" className="flex shrink-0 items-center gap-2">
            {usuario.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={usuario.avatar} alt="" referrerPolicy="no-referrer" className="size-9 rounded-full" />
            ) : (
              <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-accent to-accent2 font-extrabold text-black">
                {(usuario.nombre ?? usuario.email)[0]?.toUpperCase()}
              </span>
            )}
            <button className="text-sm text-muted hover:text-text" title={usuario.email}>
              Salir
            </button>
          </form>
        ) : (
          <BotonIngresar habilitado={supabaseConfigurado} />
        )}
      </div>
    </header>
  );
}
