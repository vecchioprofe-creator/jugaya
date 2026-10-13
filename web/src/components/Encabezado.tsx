import Link from "next/link";

const LINKS = [
  { href: "/", texto: "Inicio" },
  { href: "/#clubes", texto: "Clubes" },
  { href: "/#ultimo-momento", texto: "🔥 Último momento" },
];

export function Encabezado() {
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
        </nav>
        {/* El login con Google se activa al conectar Supabase */}
        <button
          disabled
          title="Disponible al conectar Supabase"
          className="flex shrink-0 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-neutral-800 opacity-90"
        >
          <span className="font-bold text-[#4285F4]">G</span>
          <span className="hidden sm:inline">Ingresar con Google</span>
        </button>
      </div>
    </header>
  );
}
