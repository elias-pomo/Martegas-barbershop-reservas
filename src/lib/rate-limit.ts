import "server-only";
import { db } from "./db";

/**
 * Límites de uso con ventana deslizante, guardados en la base (funciona aunque Vercel
 * reparta los pedidos entre muchas instancias). Las claves son "<acción>:<email|ip>".
 */

export async function countHits(key: string, windowMin: number, now = new Date()): Promise<number> {
  return db.rateLimitHit.count({ where: { key, createdAt: { gt: new Date(now.getTime() - windowMin * 60_000) } } });
}

export async function recordHits(keys: string[], now = new Date()) {
  if (!keys.length) return;
  await db.rateLimitHit.createMany({ data: keys.map((key) => ({ key, createdAt: now })) });
  // Limpieza ocasional de registros viejos para que la tabla no crezca.
  if (Math.random() < 0.1) {
    await db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 2 * 86_400_000) } } });
  }
}

export async function clearHits(key: string) {
  await db.rateLimitHit.deleteMany({ where: { key } });
}

/** true si alguna de las reglas ya llegó a su tope. */
export async function isLimited(
  rules: { key: string; limit: number; windowMin: number }[],
  now = new Date(),
): Promise<boolean> {
  const counts = await Promise.all(rules.map((r) => countHits(r.key, r.windowMin, now)));
  return rules.some((r, i) => counts[i] >= r.limit);
}
