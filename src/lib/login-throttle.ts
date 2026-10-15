import "server-only";
import { db } from "./db";

/** Límite de intentos fallidos de login, por email y por IP, en una ventana deslizante. */
export const LOGIN_LIMITS = { perEmail: 5, perIp: 20, windowMin: 15 };

const keys = (email: string, ip: string | null) => [`email:${email}`, ...(ip ? [`ip:${ip}`] : [])];

export async function isLoginLocked(email: string, ip: string | null, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - LOGIN_LIMITS.windowMin * 60_000);
  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { key: `email:${email}`, createdAt: { gt: since } } }),
    ip ? db.loginAttempt.count({ where: { key: `ip:${ip}`, createdAt: { gt: since } } }) : 0,
  ]);
  return byEmail >= LOGIN_LIMITS.perEmail || byIp >= LOGIN_LIMITS.perIp;
}

export async function recordLoginFailure(email: string, ip: string | null, now = new Date()) {
  await db.loginAttempt.createMany({ data: keys(email, ip).map((key) => ({ key, createdAt: now })) });
  // Limpieza de intentos viejos para que la tabla no crezca.
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 24 * 3_600_000) } } });
}

/** Un login correcto limpia los fallos de ese email (no los de la IP). */
export async function clearLoginFailures(email: string) {
  await db.loginAttempt.deleteMany({ where: { key: `email:${email}` } });
}
