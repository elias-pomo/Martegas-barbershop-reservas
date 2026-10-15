import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getMonthlySummary } from "./admin-customers";
import type { Admin } from "./auth";
import { db } from "./db";
import type { AppointmentStatus } from "./domain/rules";
import { parseSettings } from "./domain/settings";

const at = (local: string) => new Date(`${local}:00-03:00`);
const slug = `test-month-${randomBytes(4).toString("hex")}`;
let business: Admin["business"];

describe.skipIf(!process.env.DATABASE_URL)("resumen mensual (integración)", () => {
  beforeAll(async () => {
    const created = await db.business.create({
      data: { slug, name: "Mes test", timezone: "America/Argentina/Tucuman" },
    });
    business = { ...created, settings: parseSettings(created.settings) };
    const staff = await db.staff.create({ data: { businessId: created.id, name: "Barbero" } });
    const customer = await db.customer.create({ data: { businessId: created.id, name: "C", phone: "+5493817000001" } });

    const rows: [string, AppointmentStatus, number, number][] = [
      // [inicio local, estado, precio, personas]
      ["2029-12-31T22:30", "ATTENDED", 12000, 1], // diciembre local, aunque en UTC ya es 1/1 01:30
      ["2029-12-10T18:00", "ATTENDED", 15000, 1],
      ["2030-01-01T00:30", "ATTENDED", 12000, 1], // enero local, apenas pasada la medianoche
      ["2030-01-05T18:00", "ATTENDED", 30000, 2], // domicilio de 2 personas
      ["2030-01-06T18:00", "NO_SHOW", 12000, 1],
      ["2030-01-07T18:00", "CANCELLED_BY_CUSTOMER", 12000, 1],
      ["2030-01-20T18:00", "CONFIRMED", 15000, 1], // pendiente
      ["2030-02-03T18:00", "CONFIRMED", 12000, 1], // otro mes: no cuenta
    ];
    await db.appointment.createMany({
      data: rows.map(([start, status, price, people]) => ({
        businessId: created.id,
        staffId: staff.id,
        customerId: customer.id,
        startsAt: at(start),
        endsAt: new Date(at(start).getTime() + 3_600_000),
        status,
        price,
        people,
        cancelToken: randomBytes(12).toString("hex"),
        cancelCodeHash: "x",
        // Enero: el de las 00:30 se cobró en efectivo y el domicilio por transferencia.
        paymentMethod: start === "2030-01-01T00:30" ? ("CASH" as const) : start === "2030-01-05T18:00" ? ("TRANSFER" as const) : null,
      })),
    });
  });

  afterAll(async () => {
    await db.business.delete({ where: { id: business.id } });
    await db.$disconnect();
  });

  it("suma cortes (personas) y recaudación de turnos asistidos por mes local", async () => {
    const summary = await getMonthlySummary(business, at("2030-01-15T10:00"));
    expect(summary.current).toEqual({
      month: "2030-01-01",
      cuts: 3,
      revenue: 42000,
      cash: 12000,
      transfer: 30000,
      unregistered: 0,
    });
    // Diciembre no tiene cobros registrados: todo queda "sin marcar".
    expect(summary.previous).toEqual({
      month: "2029-12-01",
      cuts: 2,
      revenue: 27000,
      cash: 0,
      transfer: 0,
      unregistered: 27000,
    });
    expect(summary.pending).toEqual({ cuts: 1, revenue: 15000 });
  });
});
