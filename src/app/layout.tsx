import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Fuentes incluidas en el proyecto (src/app/fonts, licencia OFL): el build no depende de
 * descargar nada de Google Fonts, que puede fallar en el deploy.
 */

// Barlow: letra de cartelería, combina con la Bebas del nombre y se lee bien chica.
const body = localFont({
  variable: "--font-barlow",
  display: "swap",
  src: [
    { path: "./fonts/barlow-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/barlow-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/barlow-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/barlow-700.woff2", weight: "700", style: "normal" },
  ],
});

const display = localFont({
  variable: "--font-bebas",
  display: "swap",
  src: [{ path: "./fonts/bebas-neue-400.woff2", weight: "400", style: "normal" }],
});

export const metadata: Metadata = {
  title: { default: "Agendapp", template: "%s · Agendapp" },
  description: "Reservá tu turno online en segundos.",
  icons: { icon: "/api/icon?size=64&text=A" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
