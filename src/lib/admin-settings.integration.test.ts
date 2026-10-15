import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createManualAppointment, setAppointmentStatus } from "./admin";
import { getCustomerDetail, listCustomers, renameCustomer } from "./admin-customers";
import {
  changeOwnPassword,
  getSettingsData,
  saveServices,
  saveWorkingHours,
  updateBusinessInfo,
  updateSettings,
} from "./admin-settings";
import type { Admin } from "./auth";
import { getServiceAvailability } from "./booking";
import { db } from "./db";
import { parseSettings } from "./domain/settings";
import { hashPassword, verifyPassword } from "./password";

/** Clientes y Ajustes contra la base local. Semana: lunes 7/1/2030 … sábado 12/1/2030. */
const at = (local: string) => new Date(`${local}:00-03:00`);
const NOW = at("2030-01-07T09:00");
const slug = `test-settings-${randomBytes(4).toString("hex")}`;
let business: Admin["business"];
let userId = "";

const reload = async () => {
  const b = await db.business.findUniqueOrThrow({ where: { id: business.id } });
  business = { ...b, settings: parseSettings(b.settings) };
};

describe.skipIf(!process.env.DATABASE_URL)("clientes y ajustes (integración)", () => {
  beforeAll(async () => {
    const created = await db.business.create({
      data: {
        slug,
        name: "Settings test",
        timezone: "America/Argentina/Tucuman",
        settings: { defaultAreaCode: "381" },
        services: { create: [{ name: "Corte", durationMin: 60, price: 12000 }] },
        users: { create: { email: `${slug}@test.local`, passwordHash: await hashPassword("actual12345") } },
      },
      include: { services: true, users: true },
    });
    userId = created.users[0].id;
    business = { ...created, settings: parseSettings(created.settings) };
    await db.staff.create({
      data: {
        businessId: created.id,
        name: "Barbero",
        services: { create: [{ serviceId: created.services[0].id }] },
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

  it("cuenta visitas, faltas y cancelaciones por cliente", async () => {
    const base = { type: "REGULAR" as const, serviceId: (await getSettingsData(business)).services[0].id, durationMin: 60, price: 12000, people: 1, name: "Ana López", phone: "381 6000001" };
    const a1 = await createManualAppointment(business, { ...base, day: "2030-01-07", time: "15:00" });
    const a2 = await createManualAppointment(business, { ...base, day: "2030-01-08", time: "15:00" });
    await createManualAppointment(business, { ...base, day: "2030-01-09", time: "15:00" });
    if (!a1.ok || !a2.ok) throw new Error("no cargó");

    const ids = await db.appointment.findMany({ where: { businessId: business.id }, orderBy: { startsAt: "asc" } });
    await db.appointment.update({ where: { id: ids[0].id }, data: { status: "ATTENDED" } });
    await setAppointmentStatus(business, ids[1].id, "NO_SHOW", NOW);

    const [row] = await listCustomers(business);
    expect(row.stats).toEqual({ attended: 1, noShows: 1, cancelled: 0, upcoming: 1 });

    const detail = await getCustomerDetail(business, row.id);
    expect(detail?.appointments).toHaveLength(3);
    expect(detail?.blocked).toBe(false);

    expect(await renameCustomer(business, row.id, "  Ana   María López ")).toBe(true);
    expect((await db.customer.findUniqueOrThrow({ where: { id: row.id } })).name).toBe("Ana María López");
  });

  it("guardar datos del negocio normaliza el WhatsApp y arma el link de Maps", async () => {
    expect(
      await updateBusinessInfo(business, {
        name: "Nuevo nombre",
        address: "Lavalle 856, Tucumán",
        whatsapp: "+34 641 31 12 13",
        instagram: "",
        paymentAlias: "mi.alias",
        paymentHolder: "Martín",
      }),
    ).toEqual({ ok: true });
    const b = await db.business.findUniqueOrThrow({ where: { id: business.id } });
    expect(b.whatsapp).toBe("+34641311213");
    expect(b.mapsUrl).toContain("Lavalle%20856");
    expect(await updateBusinessInfo(business, { name: "X Y", address: "", whatsapp: "123", instagram: "", paymentAlias: "", paymentHolder: "" })).toMatchObject({ ok: false });
  });

  it("los horarios guardados cambian la disponibilidad pública", async () => {
    const { hours, services } = await getSettingsData(business);
    // Lunes cerrado, martes de 10 a 12.
    const next = hours.map((h) =>
      h.weekday === 1 ? { ...h, open: false } : h.weekday === 2 ? { ...h, firstStart: "10:00", lastStart: "12:00" } : h,
    );
    expect(await saveWorkingHours(business, next)).toEqual({ ok: true });

    const availability = await getServiceAvailability(slug, services[0].id, NOW);
    expect(availability!.days.find((d) => d.date === "2030-01-07")!.open).toBe(false);
    const tuesday = availability!.days.find((d) => d.date === "2030-01-08")!;
    expect(tuesday.slots.map((s) => s.start.toISOString())).toEqual(
      ["10:00", "11:00", "12:00"].map((t) => at(`2030-01-08T${t}`).toISOString()),
    );

    expect(await saveWorkingHours(business, next.map((h) => (h.weekday === 3 ? { ...h, firstStart: "20:00", lastStart: "15:00" } : h)))).toMatchObject({ ok: false });
  });

  it("agrega y desactiva servicios", async () => {
    const { services } = await getSettingsData(business);
    expect(
      await saveServices(business, [
        { ...services[0], active: false },
        { name: "Barba", description: "  Perfilado con navaja  ", durationMin: 30, price: 5000, active: true },
      ]),
    ).toEqual({ ok: true });
    const after = await getSettingsData(business);
    expect(after.services.filter((s) => s.active).map((s) => s.name)).toEqual(["Barba"]);
    expect(after.services.find((s) => s.name === "Barba")?.description).toBe("Perfilado con navaja");
    // El servicio nuevo lo hace el barbero: tiene disponibilidad.
    const barba = after.services.find((s) => s.name === "Barba")!;
    const availability = await getServiceAvailability(slug, barba.id, NOW);
    expect(availability!.days.some((d) => d.slots.length > 0)).toBe(true);

    expect(await saveServices(business, after.services.map((s) => ({ ...s, active: false })))).toMatchObject({ ok: false });
  });

  it("actualiza reglas y plantillas sin perder lo demás", async () => {
    expect(await updateSettings(business, { minLeadMin: 30, cancelMinHours: 3 })).toEqual({ ok: true });
    await reload();
    expect(business.settings).toMatchObject({ minLeadMin: 30, cancelMinHours: 3, defaultAreaCode: "381", maxPerWeek: 2 });

    expect(await updateSettings(business, { waTemplates: { ...business.settings.waTemplates, reminder: "Hola {nombre}!" } })).toEqual({ ok: true });
    await reload();
    expect(business.settings.waTemplates.reminder).toBe("Hola {nombre}!");
    expect(business.settings.minLeadMin).toBe(30);

    expect(await updateSettings(business, { maxPerWeek: 0 })).toMatchObject({ ok: false });
  });

  it("cambia la contraseña desde el panel solo con la actual correcta", async () => {
    expect(await changeOwnPassword(userId, "incorrecta1", "nueva123456")).toMatchObject({ ok: false });
    expect(await changeOwnPassword(userId, "actual12345", "corta")).toMatchObject({ ok: false });
    const result = await changeOwnPassword(userId, "actual12345", "nueva123456");
    expect(result).toEqual({ ok: true, version: 1 });
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verifyPassword("nueva123456", user.passwordHash)).toBe(true);
  });
});
