import { iconSet, manifestResponse } from "@/lib/manifest";

/**
 * Manifest del panel del barbero. Vive fuera de /admin porque el navegador lo pide sin
 * cookies y el proxy mandaría esa petición al login.
 */
export function GET() {
  return manifestResponse({
    id: "/admin",
    name: "Agendapp · Panel",
    short_name: "Agenda",
    description: "Agenda, clientes y avisos de turnos",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    lang: "es-AR",
    icons: iconSet("A"),
  });
}
