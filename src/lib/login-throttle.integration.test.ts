import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { clearLoginFailures, isLoginLocked, LOGIN_LIMITS, recordLoginFailure } from "./login-throttle";

const email = `throttle-${randomBytes(4).toString("hex")}@test.local`;
const ip = `10.0.${randomBytes(1)[0]}.${randomBytes(1)[0]}`;
const NOW = new Date();

describe.skipIf(!process.env.DATABASE_URL)("bloqueo de login (integración)", () => {
  afterAll(async () => {
    await db.rateLimitHit.deleteMany({ where: { key: { in: [`login-email:${email}`, `login-ip:${ip}`] } } });
    await db.$disconnect();
  });

  it("bloquea el email después de 5 fallos y lo libera al pasar la ventana", async () => {
    for (let i = 0; i < LOGIN_LIMITS.perEmail - 1; i++) await recordLoginFailure(email, ip, NOW);
    expect(await isLoginLocked(email, ip, NOW)).toBe(false);
    await recordLoginFailure(email, ip, NOW);
    expect(await isLoginLocked(email, ip, NOW)).toBe(true);
    // Otro email desde otra IP no está bloqueado.
    expect(await isLoginLocked(`otro-${email}`, "10.9.9.9", NOW)).toBe(false);
    // 16 minutos después, se puede volver a intentar.
    expect(await isLoginLocked(email, ip, new Date(NOW.getTime() + 16 * 60_000))).toBe(false);
  });

  it("un login correcto limpia los fallos del email", async () => {
    await clearLoginFailures(email);
    expect(await isLoginLocked(email, null, NOW)).toBe(false);
  });
});
