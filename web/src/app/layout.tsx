import type { Metadata } from "next";
import { Bebas_Neue, Outfit } from "next/font/google";
import { Encabezado } from "@/components/Encabezado";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const bebas = Bebas_Neue({ variable: "--font-bebas", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "JugáYa — Reservá tu cancha", template: "%s · JugáYa" },
  description:
    "Reservá canchas de fútbol, pádel, tenis y básquet. Armá tu equipo y que cada uno pague su parte desde un link.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${outfit.variable} ${bebas.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Encabezado />
        <main className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-line py-8 text-sm text-muted">
          <div className="mx-auto max-w-6xl px-4">JugáYa · Fase 2 en construcción</div>
        </footer>
      </body>
    </html>
  );
}
