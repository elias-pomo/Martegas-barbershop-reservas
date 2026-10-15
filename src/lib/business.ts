import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";
import { parseSettings } from "./domain/settings";

export const businessTag = (slug: string) => `business:${slug}`;

/**
 * Datos públicos del negocio. Se cachean y se invalidan al guardar Ajustes; además viven
 * poco (1 minuto), porque en Vercel cada instancia tiene su propio caché y la invalidación
 * no siempre llega a todas. Lo que se guarda en un turno (precio, duración) se lee aparte, fresco.
 */
export async function getBusinessBySlug(slug: string) {
  "use cache";
  cacheTag(businessTag(slug));
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });

  const business = await db.business.findUnique({
    where: { slug },
    include: {
      services: { where: { active: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!business) return null;

  return { ...business, settings: parseSettings(business.settings) };
}

export type PublicBusiness = NonNullable<Awaited<ReturnType<typeof getBusinessBySlug>>>;
