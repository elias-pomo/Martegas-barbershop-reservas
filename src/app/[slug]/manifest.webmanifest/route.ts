import { getBusinessBySlug } from "@/lib/business";
import { iconSet, initialOf, manifestResponse } from "@/lib/manifest";

/** Manifest de cada negocio: instalar la página de clientes abre directo en su inicio. */
export async function GET(_request: Request, { params }: RouteContext<"/[slug]/manifest.webmanifest">) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) return new Response("No encontrado", { status: 404 });

  return manifestResponse({
    id: `/${slug}`,
    name: business.name,
    short_name: business.name.split(/\s+/)[0].replace(/'s$/i, "") || business.name,
    description: `Reservá tu turno en ${business.name}`,
    start_url: `/${slug}`,
    scope: `/${slug}`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    lang: "es-AR",
    icons: iconSet(initialOf(business.name)),
  });
}
