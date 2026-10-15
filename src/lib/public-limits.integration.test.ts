import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { BOOKING_LIMITS, bookingLimited, recordBooking, recordWaitlist, waitlistLimited, WAITLIST_LIMITS } from "./public-limits";

const slug = `limits-${randomBytes(3).toString("hex")}`;
const ip = `10.9.${randomBytes(1)[0]}.${randomBytes(1)[0]}`;
const at = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * 60_000);

describe.skipIf(!process.env.DATABASE_URL)("límites públicos por conexión (integración)", () => {
  afterAll(async () => {
    await db.rateLimitHit.deleteMany({ where: { key: { contains: `:${slug}:` } } });
    await db.$disconnect();
  });

  it("frena después de 3 reservas en una hora y deja seguir en la hora siguiente", async () => {
    for (let i = 0; i < BOOKING_LIMITS.perHour; i++) await recordBooking(slug, ip, at(0));
    expect(await bookingLimited(slug, ip, at(1))).toBe(true);
    // Otra conexión no está afectada.
    expect(await bookingLimited(slug, "10.8.8.8", at(1))).toBe(false);
    // 61 minutos después vuelve a poder.
    expect(await bookingLimited(slug, ip, at(61))).toBe(false);
  });

  it("frena después de 6 reservas en el día aunque estén espaciadas", async () => {
    for (let i = 0; i < BOOKING_LIMITS.perDay - BOOKING_LIMITS.perHour; i++) await recordBooking(slug, ip, at(120 + i * 61));
    expect(await bookingLimited(slug, ip, at(120 + 4 * 61))).toBe(true);
  });

  it("sin IP conocida no bloquea (no se puede identificar la conexión)", async () => {
    expect(await bookingLimited(slug, null)).toBe(false);
  });

  it("lista de espera: 5 por hora", async () => {
    for (let i = 0; i < WAITLIST_LIMITS.perHour; i++) await recordWaitlist(slug, ip, at(0));
    expect(await waitlistLimited(slug, ip, at(1))).toBe(true);
  });
});
