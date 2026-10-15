import type { Metadata } from "next";
import { getBusinessBySlug } from "@/lib/business";
import { appleIcon, initialOf } from "@/lib/manifest";

export async function generateMetadata({ params }: LayoutProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) return {};
  const letter = initialOf(business.name);

  const description = `Reservá tu turno en ${business.name}${business.address ? ` · ${business.address}` : ""}.`;
  return {
    description,
    // La imagen la genera opengraph-image.tsx; acá van título y texto de la vista previa.
    openGraph: { title: business.name, description, type: "website", locale: "es_AR", siteName: business.name },
    twitter: { card: "summary_large_image", title: business.name, description },
    manifest: `/${slug}/manifest.webmanifest`,
    icons: { icon: `/api/icon?size=64&text=${letter}`, apple: appleIcon(letter) },
    appleWebApp: { capable: true, title: business.name, statusBarStyle: "black-translucent" },
  };
}

export default function BusinessLayout({ children }: LayoutProps<"/[slug]">) {
  return children;
}
