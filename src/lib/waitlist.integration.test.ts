import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Admin } from "./auth";
import { db } from "./db";
import { parseSettings } from "./domain/settings";
import { appointmentPayload } from "./notifications";
import { countWaiting, getWaitlistForDay, joinWaitlist, setWaitlistStatus } from "./waitlist";

/** Semana de referencia: lunes 7/1/2030 … sábado 12/1/2030. */
const at = (local: string) => new Date(`${local}:00-03:00`);
const NOW = at("2030-01-07T09:00");
const slug = `test-wait-${randomBytes(4).toString("hex")}`;
let business: Admin["business"];

describe.skipIf(!process.env.DATABASE_URL)("lista de espera (integración)", () => {
  beforeAll(async () => {
    const created = await db.business.create({
      data: {
        slug,
        name: "Espera test",
        timezone: "America/Argentina/Tucuman",
        settings: { defaultAreaCode: "381" },
        services: { create: [{ name: "Corte", durationMin: 60, price: 12000 }] },
      },
    });
    business = { ...created, settings: parseSettings(created.settings) };
  });

  afterAll(async () => {
    await db.business.delete({ where: { id: business.id } });
    await db.$disconnect();
  });

  it("anota al cliente una sola vez por día (si repite, se actualiza)", async () => {
    expect(await joinWaitlist(slug, { day: "2030-01-09", name: "Ana", phone: "381 8000001" }, NOW)).toEqual({ ok: true });
    expect(await joinWaitlist(slug, { day: "2030-01-09", name: "Ana López", phone: "3818000001" }, NOW)).toEqual({ ok: true });
    expect(await joinWaitlist(slug, { day: "2030-01-09", name: "Bruno", phone: "381 8000002" }, NOW)).toEqual({ ok: true });

    const list = await getWaitlistForDay(business, "2030-01-09");
    expect(list.map((e) => e.name)).toEqual(["Ana López", "Bruno"]);
    expect(list[0].phone).toBe("+5493818000001");
    expect(await countWaiting(business.id, "2030-01-09")).toBe(2);
  });

  it("rechaza días fuera de la semana y teléfonos inválidos", async () => {
    expect(await joinWaitlist(slug, { day: "2030-01-14", name: "C", phone: "381 8000003" }, NOW)).toMatchObject({ ok: false });
    expect(await joinWaitlist(slug, { day: "2030-01-10", name: "C", phone: "123" }, NOW)).toMatchObject({ ok: false });
  });

  it("contactado sigue en la lista; quitado desaparece", async () => {
    const [ana, bruno] = await getWaitlistForDay(business, "2030-01-09");
    expect(await setWaitlistStatus(business, ana.id, "CONTACTED")).toEqual({ ok: true });
    expect(await setWaitlistStatus(business, bruno.id, "CLOSED")).toEqual({ ok: true });
    const list = await getWaitlistForDay(business, "2030-01-09");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Ana López", status: "CONTACTED" });
    expect(await countWaiting(business.id, "2030-01-09")).toBe(1);
  });

  it("el aviso de cancelación al barbero menciona la lista de espera", () => {
    const base = { customerName: "Juan", serviceName: "Corte", startsAt: at("2030-01-09T18:00"), timeZone: "America/Argentina/Tucuman" };
    expect(appointmentPayload("cancelled", { ...base, waiting: 2 }).body).toContain("2 en lista de espera");
    expect(appointmentPayload("cancelled", { ...base, waiting: 0 }).body).toContain("quedó libre");
  });
});
