import type { Metadata, Viewport } from "next";
import { Barlow, Bebas_Neue } from "next/font/google";
import "./globals.css";

// Barlow: letra de cartelería, combina con la Bebas del nombre y se lee bien chica.
const body = Barlow({
  variable: "--font-barlow",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const display = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
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
