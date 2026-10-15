import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cancelByToken, findByPhoneAndCode, getAppointmentByToken } from "./appointments";
import { createBooking, getServiceAvailability } from "./booking";
import { db } from "./db";
import { businessSettingsSchema } from "./domain/settings";

/**
 * Integración contra la base local (`npm run db:dev`). Crea un negocio temporal
 * y lo borra al final. Semana de referencia: lunes 7/1/2030 … sábado 12/1/2030.
 */
const at = (local: string) => new Date(`${local}:00-03:00`);
const NOW = at("2030-01-07T09:00");
const slug = `test-${randomBytes(4).toString("hex")}`;
let businessId = "";
let corteId = "";

const book = (start: string, phone: string, now = NOW) =>
  createBooking({ slug, serviceId: corteId, startsAt: at(start), name: "Test", phone, now });

describe.skipIf(!process.env.DATABASE_URL)("reservas (integración)", () => {
  beforeAll(async () => {
    const business = await db.business.create({
      data: {
        slug,
        name: "Negocio de prueba",
        timezone: "America/Argentina/Tucuman",
        settings: businessSettingsSchema.parse({ defaultAreaCode: "381" }),
        services: { create: [{ name: "Corte", durationMin: 60, price: 12000 }] },
      },
      include: { services: true },
    });
    businessId = business.id;
    corteId = business.services[0].id;
    await db.staff.create({
      data: {
        businessId,
        name: "Barbero",
        services: { create: [{ serviceId: corteId }] },
        workingHours: {
          create: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, firstStart: "15:00", lastStart: "22:00" })),
        },
      },
    });
  });

  afterAll(async () => {
    await db.cancelAttempt.deleteMany({ where: { businessId } });
    await db.business.delete({ where: { id: businessId } });
    await db.$disconnect();
  });

  it("reserva un turno y normaliza el teléfono", async () => {
    const result = await book("2030-01-07T15:00", "0381 15 4000001");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appointment.code).toMatch(/^\d{4}$/);
    const customer = await db.customer.findFirstOrThrow({ where: { businessId } });
    expect(customer.phone).toBe("+5493814000001");
  });

  it("el horario reservado desaparece de la disponibilidad", async () => {
    const availability = await getServiceAvailability(slug, corteId, NOW);
    const monday = availability!.days.find((d) => d.date === "2030-01-07")!;
    expect(monday.slots.map((s) => s.start.getTime())).not.toContain(at("2030-01-07T15:00").getTime());
    expect(monday.slots).toHaveLength(7);
  });

  it("otro cliente no puede tomar el mismo horario", async () => {
    const result = await book("2030-01-07T15:00", "381 4000002");
    expect(result).toMatchObject({ ok: false, error: { code: "SLOT_TAKEN" } });
  });

  it("aplica el límite semanal: martes no, miércoles sí, tercero no", async () => {
    expect(await book("2030-01-08T15:00", "381 4000001")).toMatchObject({ ok: false, error: { code: "WEEKLY_LIMIT" } });
    expect((await book("2030-01-09T15:00", "381 4000001")).ok).toBe(true);
    expect(await book("2030-01-12T15:00", "381 4000001")).toMatchObject({ ok: false, error: { code: "WEEKLY_LIMIT" } });
  });

  it("rechaza horarios fuera de la semana habilitada", async () => {
    expect(await book("2030-01-14T15:00", "381 4000003")).toMatchObject({ ok: false, error: { code: "SLOT_TAKEN" } });
  });

  it("encuentra el turno con teléfono + código y limita los intentos fallidos", async () => {
    const booked = await book("2030-01-10T18:00", "381 4000004");
    if (!booked.ok) throw new Error("no reservó");
    const { code, token } = booked.appointment;

    expect(await findByPhoneAndCode(slug, "3814000004", code, NOW)).toEqual({ ok: true, token });

    const wrong = code === "0000" ? "1111" : "0000";
    for (let i = 0; i < 5; i++) {
      expect((await findByPhoneAndCode(slug, "3814000004", wrong, NOW)).ok).toBe(false);
    }
    // Con 5 fallos, ni el código correcto pasa durante 15 minutos.
    expect(await findByPhoneAndCode(slug, "3814000004", code, NOW)).toMatchObject({ ok: false, message: expect.stringMatching(/Demasiados/) });
  });

  it("cancela con 5 horas o más y libera el horario", async () => {
    const booked = await book("2030-01-11T20:00", "381 4000005");
    if (!booked.ok) throw new Error("no reservó");
    const { token } = booked.appointment;

    expect(await cancelByToken(slug, token, at("2030-01-11T15:00"))).toEqual({ ok: true });
    expect((await getAppointmentByToken(slug, token, NOW))!.appointment.status).toBe("CANCELLED_BY_CUSTOMER");
    expect((await cancelByToken(slug, token, NOW)).ok).toBe(false);
    expect((await book("2030-01-11T20:00", "381 4000006")).ok).toBe(true);
  });

  it("no cancela online a menos de 5 horas", async () => {
    const booked = await book("2030-01-11T21:00", "381 4000007");
    if (!booked.ok) throw new Error("no reservó");
    const result = await cancelByToken(slug, booked.appointment.token, at("2030-01-11T16:01"));
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/WhatsApp/) });
  });

  it("con 10 faltas solo puede pedir turno por WhatsApp", async () => {
    const customer = await db.customer.create({ data: { businessId, name: "Faltador", phone: "+5493814000008" } });
    const staff = await db.staff.findFirstOrThrow({ where: { businessId } });
    await db.appointment.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        businessId,
        staffId: staff.id,
        customerId: customer.id,
        startsAt: new Date(Date.UTC(2029, 0, 1 + i, 18)),
        endsAt: new Date(Date.UTC(2029, 0, 1 + i, 19)),
        price: 12000,
        status: "NO_SHOW" as const,
        cancelToken: randomBytes(12).toString("hex"),
        cancelCodeHash: "x",
      })),
    });
    expect(await book("2030-01-12T16:00", "381 4000008")).toMatchObject({ ok: false, error: { code: "BLOCKED" } });
  });
});
