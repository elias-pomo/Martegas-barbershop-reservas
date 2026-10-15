import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getBusinessBySlug } from "@/lib/business";

/**
 * Vista previa al compartir el link (WhatsApp, Instagram, etc.): el cartel de neón
 * del negocio sobre negro, con la dirección y la invitación a reservar.
 */
export const alt = "Reservá tu turno online";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PURPLE_GLOW = "0 0 4px #fff, 0 0 14px #8b5cf6, 0 0 26px #8b5cf6";
const GREEN_GLOW = "0 0 4px #fff, 0 0 14px #22c55e, 0 0 26px #22c55e";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [business, bebas] = await Promise.all([
    getBusinessBySlug(slug),
    readFile(join(process.cwd(), "assets/fonts/bebas-neue.woff")),
  ]);

  const [first, ...rest] = (business?.name ?? "Agendapp").trim().split(/\s+/);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse at center, #1a1424 0%, #0b0b0b 70%)",
          fontFamily: "Bebas",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 150, lineHeight: 0.95, color: "#f3e8ff", textShadow: PURPLE_GLOW, letterSpacing: 4 }}>{first}</div>
        {rest.length > 0 && (
          <div style={{ fontSize: 150, lineHeight: 0.95, color: "#ecfdf3", textShadow: GREEN_GLOW, letterSpacing: 4 }}>
            {rest.join(" ")}
          </div>
        )}
        <div
          style={{
            marginTop: 36,
            width: 520,
            height: 4,
            borderRadius: 4,
            background: "linear-gradient(90deg, transparent, #b388ff 20%, #6ee7a0 80%, transparent)",
          }}
        />
        <div style={{ marginTop: 30, fontSize: 56, letterSpacing: 6, color: "#e4e4e7" }}>Reservá tu turno online</div>
        {business?.address && <div style={{ marginTop: 6, fontSize: 36, letterSpacing: 3, color: "#a1a1aa" }}>{business.address}</div>}
      </div>
    ),
    { ...size, fonts: [{ name: "Bebas", data: bebas, weight: 400, style: "normal" }] },
  );
}
