import type { MetadataRoute } from "next";

/** Inicial para el ícono: primera letra significativa del nombre ("Martega's Barber Shop" → "M"). */
export function initialOf(name: string): string {
  return (name.match(/\p{L}/u)?.[0] ?? "A").toUpperCase();
}

export function iconSet(letter: string): MetadataRoute.Manifest["icons"] {
  const src = (size: number, extra = "") => `/api/icon?size=${size}&text=${encodeURIComponent(letter)}${extra}`;
  return [
    { src: src(192), sizes: "192x192", type: "image/png", purpose: "any" },
    { src: src(512), sizes: "512x512", type: "image/png", purpose: "any" },
    { src: src(512, "&maskable=1"), sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];
}

export const appleIcon = (letter: string) => `/api/icon?size=180&text=${encodeURIComponent(letter)}&maskable=1`;

export function manifestResponse(manifest: MetadataRoute.Manifest) {
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
