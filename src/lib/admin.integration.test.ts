import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createBlock,
  createManualAppointment,
  deleteBlock,
  getDayAgenda,
  persistAttended,
  setAppointmentStatus,
} from "./admin";
import type { Admin } from "./auth";
import { createBooking, getServiceAvailability } from "./booking";
import { db } from "./db";
import { parseSettings } from "./domain/settings";

/** Integración del panel contra la base local. Semana: lunes 7/1/2030 … sábado 12/1/2030. */
const at = (local: string) => new Date(`${local}:00-03:00`);
const NOW = at("2030-01-07T09:00");
const slug = `test-admin-${randomBytes(4).toString("hex")}`;
let business: Admin["business"];
let corteId = "";

const manual = (overrides: Partial<Parameters<typeof createManualAppointment>[1]> = {}) =>
  createManualAppointment(business, {
    day: "2030-01-08",
    time: "15:00",
    type: "REGULAR",
    serviceId: corteId,
    durationMin: 60,
    price: 12000,
    people: 1,
    name: "Manual",
    phone: "381 5000001",
    ...overrides,
  });

describe.skipIf(!process.env.DATABASE_URL)("panel del barbero (integración)", () => {
  beforeAll(async () => {
    const created = await db.business.create({
      data: {
        slug,
        name: "Negocio admin test",
        timezone: "America/Argentina/Tucuman",
        settings: { defaultAreaCode: "381" },
        services: { create: [{ name: "Corte", durationMin: 60, price: 12000 }] },
      },
      include: { services: true },
    });
    corteId = created.services[0].id;
    business = { ...created, settings: parseSettings(created.settings) };
    await db.staff.create({
      data: {
        businessId: created.id,
        name: "Barbero",
        services: { create: [{ serviceId: corteId }] },
        workingHours: {
          create: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, firstStart: "15:00", lastStart: "22:00" })),
        },
      },
    });
  });

  afterAll(async () => {
    await db.business.delete({ where: { id: business.id } });
    await db.$disconnect();
  });

  it("carga un turno manual fuera de horario (domingo) sin aplicar reglas públicas", async () => {
    const result = await manual({ day: "2030-01-13", time: "11:00", type: "SPECIAL", serviceId: undefined, price: 30000, people: 2 });
    expect(result).toMatchObject({ ok: true, phone: "+5493815000001" });
  });

  it("no deja cargar un turno manual superpuesto", async () => {
    expect((await manual()).ok).toBe(true);
    expect(await manual({ time: "15:30", phone: "381 5000002" })).toMatchObject({ ok: false });
  });

  it("la agenda del día muestra el turno y los huecos libres", async () => {
    const timeline = await getDayAgenda(business, "2030-01-08", NOW);
    const kinds = timeline.map((e) => e.kind);
    expect(kinds[0]).toBe("appointment");
    expect(kinds.filter((k) => k === "free")).toHaveLength(7);
  });

  it("marca falta y la deshace", async () => {
    const [entry] = (await getDayAgenda(business, "2030-01-08", NOW)).filter((e) => e.kind === "appointment");
    if (entry.kind !== "appointment") throw new Error();
    expect(await setAppointmentStatus(business, entry.item.id, "NO_SHOW", NOW)).toEqual({ ok: true });
    expect((await db.appointment.findUniqueOrThrow({ where: { id: entry.item.id } })).status).toBe("NO_SHOW");
    // Deshacer antes de que termine el turno → vuelve a confirmado.
    expect(await setAppointmentStatus(business, entry.item.id, "ATTENDED", NOW)).toEqual({ ok: true });
    expect((await db.appointment.findUniqueOrThrow({ where: { id: entry.item.id } })).status).toBe("CONFIRMED");
  });

  it("los turnos terminados pasan a asistido al abrir el panel", async () => {
    await persistAttended(business.id, at("2030-01-08T16:30"));
    const a = await db.appointment.findFirstOrThrow({ where: { businessId: business.id, startsAt: at("2030-01-08T15:00") } });
    expect(a.status).toBe("ATTENDED");
  });

  it("un bloqueo con turnos primero avisa, después cancela y saca el horario de la web", async () => {
    const booked = await createBooking({ slug, serviceId: corteId, startsAt: at("2030-01-09T18:00"), name: "Cliente", phone: "381 5000003", now: NOW });
    expect(booked.ok).toBe(true);

    const preview = await createBlock(business, { day: "2030-01-09", allDay: false, from: "17:00", to: "20:00", cancelConflicts: false }, NOW);
    expect(preview).toMatchObject({ ok: true, blocked: false, conflicts: [{ customerName: "Cliente" }] });

    const done = await createBlock(business, { day: "2030-01-09", allDay: false, from: "17:00", to: "20:00", cancelConflicts: true }, NOW);
    expect(done).toMatchObject({ ok: true, blocked: true });

    const availability = await getServiceAvailability(slug, corteId, NOW);
    const wednesday = availability!.days.find((d) => d.date === "2030-01-09")!;
    const hours = wednesday.slots.map((s) => s.start.toISOString());
    expect(hours).not.toContain(at("2030-01-09T17:00").toISOString());
    expect(hours).not.toContain(at("2030-01-09T19:00").toISOString());
    expect(hours).toContain(at("2030-01-09T20:00").toISOString());

    const cancelled = await db.appointment.findFirstOrThrow({ where: { businessId: business.id, startsAt: at("2030-01-09T18:00") } });
    expect(cancelled.status).toBe("CANCELLED_BY_BUSINESS");
  });

  it("quitar el bloqueo devuelve los horarios", async () => {
    const block = await db.timeOff.findFirstOrThrow({ where: { staff: { businessId: business.id } } });
    expect(await deleteBlock(business, block.id)).toEqual({ ok: true });
    const availability = await getServiceAvailability(slug, corteId, NOW);
    const wednesday = availability!.days.find((d) => d.date === "2030-01-09")!;
    expect(wednesday.slots.map((s) => s.start.toISOString())).toContain(at("2030-01-09T17:00").toISOString());
  });

  it("no permite tocar turnos de otro negocio", async () => {
    const other = await db.appointment.findFirst({ where: { businessId: { not: business.id } } });
    if (other) expect(await setAppointmentStatus(business, other.id, "NO_SHOW", NOW)).toMatchObject({ ok: false });
  });
});
