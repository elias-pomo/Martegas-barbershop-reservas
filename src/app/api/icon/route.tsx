import { ImageResponse } from "next/og";

/**
 * Ícono de la app generado al vuelo: inicial sobre degradé morado → verde.
 *   /api/icon?size=192&text=M            ícono normal (bordes redondeados)
 *   /api/icon?size=512&text=M&maskable=1 a sangre, con la letra en la zona segura
 *   /api/icon?size=96&text=A&badge=1     monocromo para la barra de notificaciones de Android
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const size = Math.min(Math.max(Number(params.get("size")) || 192, 16), 1024);
  const text = (params.get("text") || "A").slice(0, 2).toUpperCase();
  const maskable = params.has("maskable");
  const badge = params.has("badge");

  const letter = (
    <span style={{ fontSize: size * (maskable ? 0.42 : 0.56), fontWeight: 800, color: "#ffffff", lineHeight: 1 }}>
      {text}
    </span>
  );

  const body = badge ? (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: size * 0.7, fontWeight: 800, color: "#ffffff" }}>{text}</span>
    </div>
  ) : (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0b0b",
        borderRadius: maskable ? 0 : size * 0.22,
      }}
    >
      <div
        style={{
          width: maskable ? "62%" : "78%",
          height: maskable ? "62%" : "78%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: size * 0.18,
          backgroundImage: "linear-gradient(135deg, #8b5cf6 0%, #d946ef 55%, #22c55e 100%)",
        }}
      >
        {letter}
      </div>
    </div>
  );

  return new ImageResponse(body, {
    width: size,
    height: size,
    headers: { "Cache-Control": "public, max-age=604800, immutable" },
  });
}
