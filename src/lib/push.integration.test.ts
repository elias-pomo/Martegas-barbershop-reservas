import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// El servicio de push real no se usa en tests: una suscripción "vence" (410), la otra recibe.
const sent: string[] = [];
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (sub: { endpoint: string }, body: string) => {
      if (sub.endpoint.includes("vencida")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      sent.push(body);
      return { statusCode: 201 };
    },
  },
}));

process.env.VAPID_PUBLIC_KEY ||= "test-public";
process.env.VAPID_PRIVATE_KEY ||= "test-private";
process.env.VAPID_SUBJECT ||= "mailto:test@test.local";

const { db } = await import("./db");
const { notifyBusiness } = await import("./push");
const { appointmentPayload } = await import("./notifications");

const slug = `test-push-${randomBytes(4).toString("hex")}`;
let businessId = "";

describe("appointmentPayload", () => {
  const a = {
    customerName: "Juan Pérez",
    serviceName: "Corte + barba",
    startsAt: new Date("2026-10-15T21:00:00Z"),
    timeZone: "America/Argentina/Tucuman",
  };

  it("arma el aviso de turno nuevo con link al día en la agenda", () => {
    const p = appointmentPayload("booked", a);
    expect(p.title).toMatch(/^Nuevo turno · jue/);
    expect(p.title).toContain("18:00");
    expect(p.body).toBe("Juan Pérez — Corte + barba");
    expect(p.url).toBe("/admin?dia=2026-10-15");
  });

  it("arma el aviso de cancelación", () => {
    const p = appointmentPayload("cancelled", a);
    expect(p.title).toMatch(/^Turno cancelado/);
    expect(p.body).toContain("El horario quedó libre");
  });
});

describe.skipIf(!process.env.DATABASE_URL)("notifyBusiness (integración)", () => {
  beforeAll(async () => {
    const business = await db.business.create({
      data: {
        slug,
        name: "Push test",
        timezone: "America/Argentina/Tucuman",
        users: {
          create: {
            email: `${slug}@test.local`,
            passwordHash: "x",
            pushSubscriptions: {
              create: [
                { endpoint: `https://push.test/${slug}/activa`, p256dh: "k", auth: "a" },
                { endpoint: `https://push.test/${slug}/vencida`, p256dh: "k", auth: "a" },
              ],
            },
          },
        },
      },
    });
    businessId = business.id;
  });

  afterAll(async () => {
    await db.business.delete({ where: { id: businessId } });
    await db.$disconnect();
  });

  it("envía a los dispositivos del negocio y borra las suscripciones vencidas", async () => {
    const delivered = await notifyBusiness(businessId, { title: "Hola", body: "Prueba" });
    expect(delivered).toBe(1);
    expect(JSON.parse(sent.at(-1)!)).toMatchObject({ title: "Hola", body: "Prueba" });

    const remaining = await db.pushSubscription.findMany({ where: { user: { businessId } } });
    expect(remaining.map((s) => s.endpoint)).toEqual([`https://push.test/${slug}/activa`]);
  });
});
