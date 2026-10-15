import "dotenv/config";
import { test, type Page } from "@playwright/test";
import { Client } from "pg";
import { SESSION_COOKIE, signSession } from "../src/lib/session-token";

/**
 * Capturas de todas las pantallas en tamaño iPhone, para revisión visual.
 * No se corre con el resto: `npx playwright test screenshots --grep @capturas`.
 * Las imágenes quedan en test-results/capturas/.
 */

const SLUG = process.env.DEFAULT_BUSINESS_SLUG ?? "martegas";
const OUT = "test-results/capturas";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

async function shot(page: Page, name: string) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

test("capturas @capturas", async ({ page, context }) => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const user = (
    await db.query(
      'SELECT u.id, u."businessId", u."sessionVersion" FROM "User" u JOIN "Business" b ON b.id = u."businessId" WHERE b.slug = $1 LIMIT 1',
      [SLUG],
    )
  ).rows[0];
  const appointment = (
    await db.query(
      'SELECT a."cancelToken", a."customerId" FROM "Appointment" a JOIN "Business" b ON b.id = a."businessId" WHERE b.slug = $1 ORDER BY a."createdAt" DESC LIMIT 1',
      [SLUG],
    )
  ).rows[0];
  await db.end();

  await page.goto(`/${SLUG}`);
  await shot(page, "01-inicio");
  await page.goto(`/${SLUG}/reservar`);
  await shot(page, "02-reservar-servicio");
  await page.getByRole("button", { name: /Corte/ }).first().click();
  await page.getByText("¿Cuándo?").waitFor();
  await shot(page, "03-reservar-horario");
  const slot = page.locator("ul.grid button").first();
  if (await slot.count()) {
    await slot.click();
    await page.getByText("Tus datos").waitFor();
    await shot(page, "04-reservar-datos");
  }
  await page.goto(`/${SLUG}/mis-turnos`);
  await shot(page, "05-mis-turnos");
  await page.goto(`/${SLUG}/especial`);
  await shot(page, "06-especial");
  if (appointment) {
    await page.goto(`/${SLUG}/turno/${appointment.cancelToken}`);
    await shot(page, "07-turno");
  }

  await page.goto("/admin/login");
  await shot(page, "10-login");
  const token = await signSession({ userId: user.id, businessId: user.businessId, version: user.sessionVersion });
  await context.addCookies([{ name: SESSION_COOKIE, value: token, domain: "localhost", path: "/" }]);
  await page.goto("/admin");
  await page.getByRole("heading", { name: "Agenda" }).waitFor();
  await shot(page, "11-agenda");
  await page.getByRole("button", { name: "Cargar turno o bloqueo" }).click();
  await page.getByRole("dialog").waitFor();
  await shot(page, "12-cargar-turno");
  await page.goto("/admin/clientes");
  await page.getByRole("heading", { name: "Clientes" }).waitFor();
  await shot(page, "13-clientes");
  if (appointment) {
    await page.goto(`/admin/clientes/${appointment.customerId}`);
    await shot(page, "14-cliente");
  }
  await page.goto("/admin/ajustes");
  await page.getByText("Servicios y precios").waitFor();
  await shot(page, "15-ajustes");
});
