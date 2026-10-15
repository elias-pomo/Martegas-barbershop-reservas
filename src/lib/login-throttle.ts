import "server-only";
import { clearHits, isLimited, recordHits } from "./rate-limit";

/** Límite de intentos fallidos de login, por email y por IP, en una ventana deslizante. */
export const LOGIN_LIMITS = { perEmail: 5, perIp: 20, windowMin: 15 };

const emailKey = (email: string) => `login-email:${email}`;
const ipKey = (ip: string) => `login-ip:${ip}`;

export async function isLoginLocked(email: string, ip: string | null, now = new Date()): Promise<boolean> {
  return isLimited(
    [
      { key: emailKey(email), limit: LOGIN_LIMITS.perEmail, windowMin: LOGIN_LIMITS.windowMin },
      ...(ip ? [{ key: ipKey(ip), limit: LOGIN_LIMITS.perIp, windowMin: LOGIN_LIMITS.windowMin }] : []),
    ],
    now,
  );
}

export async function recordLoginFailure(email: string, ip: string | null, now = new Date()) {
  await recordHits([emailKey(email), ...(ip ? [ipKey(ip)] : [])], now);
}

/** Un login correcto limpia los fallos de ese email (no los de la IP). */
export async function clearLoginFailures(email: string) {
  await clearHits(emailKey(email));
}
