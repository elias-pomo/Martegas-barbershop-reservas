import "server-only";
import { headers } from "next/headers";

/** IP del visitante según los encabezados del proxy (Vercel completa `x-forwarded-for`). */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}
