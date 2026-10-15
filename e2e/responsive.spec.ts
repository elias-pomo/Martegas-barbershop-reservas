import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { SESSION_COOKIE, signSession } from "../src/lib/session-token";

/**
 * Recorre las pantallas en anchos de celular y falla si algo genera scroll lateral.
 * Requiere la base local con el seed (`npm run db:dev` + `npm run db:seed`).
 */

const WIDTHS = [320, 360, 375, 390, 414];
const SLUG = process.env.DEFAULT_BUSINESS_SLUG ?? "martegas";

let sessionToken = "";
let appointmentToken: string | null = null;
let customerId: string | null = null;

test.beforeAll(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const user = (
    await db.query(
      'SELECT u.id, u."businessId", u."sessionVersion" FROM "User" u JOIN "Business" b ON b.id = u."businessId" WHERE b.slug = $1 LIMIT 1',
      [SLUG],
    )
  ).rows[0];
  sessionToken = await signSession({ userId: user.id, businessId: user.businessId, version: user.sessionVersion });
  const appointment = (
    await db.query(
      'SELECT a."cancelToken", a."customerId" FROM "Appointment" a JOIN "Business" b ON b.id = a."businessId" WHERE b.slug = $1 ORDER BY a."createdAt" DESC LIMIT 1',
      [SLUG],
    )
  ).rows[0];
  appointmentToken = appointment?.cancelToken ?? null;
  customerId = appointment?.customerId ?? null;

  // Datos temporales de hoy para ver en el panel: un turno por venir (recordatorio),
  // uno ya empezado (cobro) y alguien en lista de espera. Se borran en afterAll.
  const biz = (
    await db.query('SELECT b.id, b.timezone, s.id AS "staffId" FROM "Business" b JOIN "Staff" s ON s."businessId" = b.id WHERE b.slug = $1 LIMIT 1', [SLUG])
  ).rows[0];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: biz.timezone });
  // Restos de una corrida interrumpida.
  await db.query('DELETE FROM "Appointment" WHERE "customerId" IN (SELECT id FROM "Customer" WHERE name = $1)', ["Prueba Responsive"]);
  await db.query('DELETE FROM "Customer" WHERE name = $1', ["Prueba Responsive"]);
  await db.query('DELETE FROM "WaitlistEntry" WHERE phone = $1', ["+5493810000000"]);
  const id = () => `e2e${Math.random().toString(36).slice(2, 12)}`;
  const customer = id();
  await db.query(
    'INSERT INTO "Customer" (id, "businessId", name, phone) VALUES ($1, $2, $3, $4)',
    [customer, biz.id, "Prueba Responsive", `+54938199${Math.floor(Math.random() * 1e5).toString().padStart(5, "0")}`],
  );
  const hour = 3_600_000;
  const startsSoon = new Date(Math.ceil((Date.now() + hour) / 300_000) * 300_000); // en ~1 h: para recordar
  const started = new Date(Date.now() - 30 * 60_000);
  for (const [start, status] of [
    [startsSoon, "CONFIRMED"],
    [started, "CONFIRMED"],
  ] as const) {
    await db.query(
      `INSERT INTO "Appointment" (id, "businessId", "staffId", "customerId", "startsAt", "endsAt", price, "cancelToken", "cancelCodeHash", status)
       VALUES ($1, $2, $3, $4, $5, $6, 12000, $7, 'x', $8)`,
      [id(), biz.id, biz.staffId, customer, start, new Date(start.getTime() + 15 * 60_000), id(), status],
    ).catch(() => {}); // si choca con un turno real, se omite
  }
  await db.query('INSERT INTO "WaitlistEntry" (id, "businessId", day, name, phone) VALUES ($1, $2, $3, $4, $5)', [
    id(),
    biz.id,
    today,
    "Persona En Espera Con Nombre Largo",
    "+5493810000000",
  ]);
  fixtures = { customer, businessId: biz.id, day: today, reminderDay: startsSoon.toLocaleDateString("en-CA", { timeZone: biz.timezone }) };
  await db.end();
});

let fixtures: { customer: string; businessId: string; day: string; reminderDay: string } | null = null;

test.afterAll(async () => {
  if (!fixtures) return;
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query('DELETE FROM "Appointment" WHERE "customerId" = $1', [fixtures.customer]);
  await db.query('DELETE FROM "Customer" WHERE id = $1', [fixtures.customer]);
  await db.query('DELETE FROM "WaitlistEntry" WHERE "businessId" = $1 AND phone = $2', [fixtures.businessId, "+5493810000000"]);
  await db.end();
});

/** Elementos que se salen del ancho de la ventana (ignora los que están dentro de un scroll horizontal propio). */
async function overflowReport(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const insideScroller = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return p !== document.body && p !== document.documentElement;
      }
      return false;
    };
    const offenders = [...document.querySelectorAll("body *")]
      .filter((el) => {
        if (el.closest("div[hidden]")) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > vw + 1 || r.left < -1) && !insideScroller(el);
      })
      .slice(0, 5)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const cls = (el.getAttribute("class") ?? "").split(" ").slice(0, 4).join(".");
        return `${el.tagName.toLowerCase()}.${cls} [${Math.round(r.left)}→${Math.round(r.right)}] "${(el.textContent ?? "").trim().slice(0, 30)}"`;
      });
    return { vw, scrollWidth, offenders };
  });
}

async function expectNoOverflow(page: Page, label: string) {
  // Espera a que el contenido en streaming se muestre.
  await page.waitForFunction(() => !document.querySelector("template[id^='B:']") || document.querySelectorAll("div[hidden][id^='S:']").length === 0, null, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(400);
  const report = await overflowReport(page);
  expect(report.scrollWidth, `${label}: scroll lateral (${report.scrollWidth}px en ${report.vw}px)\n${report.offenders.join("\n")}`).toBeLessThanOrEqual(report.vw);
  expect(report.offenders, `${label}: elementos fuera de pantalla`).toEqual([]);
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 760 }, hasTouch: true, isMobile: true });

    test("páginas públicas", async ({ page }) => {
      await page.goto(`/${SLUG}`);
      await expectNoOverflow(page, "inicio");

      await page.goto(`/${SLUG}/reservar`);
      await expectNoOverflow(page, "reservar: servicio");
      // Durante la animación de cambio de paso tampoco debe aparecer scroll lateral: se mide cada 25 ms.
      const maxDuringTransition = page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let max = 0;
            const id = setInterval(() => (max = Math.max(max, document.documentElement.scrollWidth)), 25);
            setTimeout(() => (clearInterval(id), resolve(max)), 900);
          }),
      );
      await page.getByRole("button", { name: /Corte/ }).first().click();
      expect(await maxDuringTransition, "reservar: durante la transición").toBeLessThanOrEqual(width);
      await page.getByText("¿Cuándo?").waitFor();
      await expectNoOverflow(page, "reservar: día y hora");
      const slot = page.locator("ul.grid button").first();
      if (await slot.count()) {
        await slot.click();
        await page.getByText("Tus datos").waitFor();
        await expectNoOverflow(page, "reservar: datos");
      }

      // Día completo simulado: se reemplaza la respuesta de horarios para ver la lista de espera.
      await page.route("**/api/*/availability*", async (route) => {
        const real = await page.request.get(route.request().url());
        const json = await real.json();
        const firstOpen = json.days.find((d: { open: boolean }) => d.open);
        if (firstOpen) firstOpen.slots = [];
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) });
      });
      await page.goto(`/${SLUG}/reservar`);
      await page.getByRole("button", { name: /Corte/ }).first().click();
      await page.getByRole("button", { name: /completo/ }).first().click();
      await page.getByText("Anotarme en lista de espera").waitFor({ timeout: 15_000 });
      await expectNoOverflow(page, "reservar: lista de espera");
      await page.unroute("**/api/*/availability*");

      await page.goto(`/${SLUG}/mis-turnos`);
      await expectNoOverflow(page, "mis turnos");

      await page.goto(`/${SLUG}/especial`);
      await expectNoOverflow(page, "especial");
      await page.getByRole("radio", { name: /A domicilio/ }).click();
      await expectNoOverflow(page, "especial: domicilio");

      if (appointmentToken) {
        await page.goto(`/${SLUG}/turno/${appointmentToken}`);
        await expectNoOverflow(page, "turno");
      }
    });

    test("panel del barbero", async ({ page, context }) => {
      await page.goto("/admin/login");
      await expectNoOverflow(page, "login");

      await context.addCookies([{ name: SESSION_COOKIE, value: sessionToken, domain: "localhost", path: "/" }]);
      await page.goto("/admin");
      await page.getByRole("heading", { name: "Agenda" }).waitFor();
      await page.getByText(/Lista de espera \(\d+\)/).waitFor();
      await expectNoOverflow(page, "agenda (con lista de espera y cobro)");

      if (fixtures && fixtures.reminderDay !== fixtures.day) await page.goto(`/admin?dia=${fixtures.reminderDay}`);
      const remindAll = page.getByRole("button", { name: /Recordar a todos/ });
      if (await remindAll.count()) {
        await remindAll.click();
        await page.getByRole("dialog", { name: "Recordatorios del día" }).waitFor();
        await expectNoOverflow(page, "hoja: recordatorios");
        await page.getByRole("button", { name: "Cerrar" }).click();
      }
      await page.goto("/admin");
      await page.getByRole("heading", { name: "Agenda" }).waitFor();

      await page.getByRole("button", { name: "Cargar turno o bloqueo" }).click();
      await page.getByRole("dialog").waitFor();
      await expectNoOverflow(page, "hoja: turno");
      await page.getByRole("button", { name: "Especial / domicilio" }).click();
      await expectNoOverflow(page, "hoja: turno especial");
      await page.getByRole("tab", { name: "Bloqueo" }).click();
      await page.getByRole("checkbox").uncheck();
      await expectNoOverflow(page, "hoja: bloqueo");

      await page.goto("/admin/clientes");
      await page.getByRole("heading", { name: "Clientes" }).waitFor();
      await expectNoOverflow(page, "clientes");

      if (customerId) {
        await page.goto(`/admin/clientes/${customerId}`);
        await expectNoOverflow(page, "detalle de cliente");
      }

      await page.goto("/admin/ajustes");
      await page.getByText("Servicios y precios").waitFor();
      await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
      await expectNoOverflow(page, "ajustes (todo abierto)");
    });
  });
}
