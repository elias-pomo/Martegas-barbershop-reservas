import "server-only";
import { cacheTag } from "next/cache";
import { db } from "./db";
import { parseSettings } from "./domain/settings";

export const businessTag = (slug: string) => `business:${slug}`;

/** Datos públicos del negocio. Cambian poco: se cachean y se invalidan al guardar Ajustes. */
export async function getBusinessBySlug(slug: string) {
  "use cache";
  cacheTag(businessTag(slug));

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
