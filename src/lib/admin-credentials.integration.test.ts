import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { updateOwnerCredentials, validatePassword } from "./admin-credentials";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";

const slug = `test-cred-${randomBytes(4).toString("hex")}`;
const email = `${slug}@test.local`;
let businessId = "";

describe("validatePassword", () => {
  it("exige largo mínimo y letras con números", () => {
    expect(validatePassword("corta1")).toMatch(/al menos/);
    expect(validatePassword("solamenteletras")).toMatch(/letras y números/);
    expect(validatePassword("barberia2026")).toBeNull();
  });
});

describe.skipIf(!process.env.DATABASE_URL)("updateOwnerCredentials (integración)", () => {
  beforeAll(async () => {
    const business = await db.business.create({
      data: {
        slug,
        name: "Credenciales test",
        timezone: "America/Argentina/Tucuman",
        users: { create: { email, passwordHash: await hashPassword("vieja12345") } },
      },
    });
    businessId = business.id;
  });

  afterAll(async () => {
    await db.business.delete({ where: { id: businessId } });
    await db.$disconnect();
  });

  it("cambia la contraseña y cierra las sesiones", async () => {
    const result = await updateOwnerCredentials(db, { slug, password: "nueva12345" });
    expect(result).toEqual({ ok: true, email });
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(await verifyPassword("nueva12345", user.passwordHash)).toBe(true);
    expect(await verifyPassword("vieja12345", user.passwordHash)).toBe(false);
    expect(user.sessionVersion).toBe(1);
  });

  it("cambia el email (normalizado a minúsculas)", async () => {
    const nuevo = `Nuevo-${slug}@Test.Local`;
    expect(await updateOwnerCredentials(db, { slug, email: nuevo })).toEqual({ ok: true, email: nuevo.toLowerCase() });
    expect((await db.user.findFirstOrThrow({ where: { businessId } })).sessionVersion).toBe(2);
  });

  it("rechaza datos inválidos sin tocar nada", async () => {
    expect(await updateOwnerCredentials(db, { slug, email: "no-es-email" })).toMatchObject({ ok: false });
    expect(await updateOwnerCredentials(db, { slug, password: "corta" })).toMatchObject({ ok: false });
    expect(await updateOwnerCredentials(db, { slug: "no-existe", password: "valida12345" })).toMatchObject({ ok: false });
    expect((await db.user.findFirstOrThrow({ where: { businessId } })).sessionVersion).toBe(2);
  });

  it("no deja usar un email de otro usuario", async () => {
    const other = await db.user.findFirst({ where: { businessId: { not: businessId } } });
    if (other) expect(await updateOwnerCredentials(db, { slug, email: other.email })).toMatchObject({ ok: false });
  });
});
