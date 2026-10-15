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
      await expectNoOverflow(page, "agenda");

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
