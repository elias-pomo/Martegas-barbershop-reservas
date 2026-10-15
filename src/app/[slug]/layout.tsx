import type { Metadata } from "next";
import { getBusinessBySlug } from "@/lib/business";
import { appleIcon, initialOf } from "@/lib/manifest";

export async function generateMetadata({ params }: LayoutProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) return {};
  const letter = initialOf(business.name);

  return {
    manifest: `/${slug}/manifest.webmanifest`,
    icons: { icon: `/api/icon?size=64&text=${letter}`, apple: appleIcon(letter) },
    appleWebApp: { capable: true, title: business.name, statusBarStyle: "black-translucent" },
  };
}

export default function BusinessLayout({ children }: LayoutProps<"/[slug]">) {
  return children;
}
