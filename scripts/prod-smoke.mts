/**
 * Prueba de humo en producción: reserva real con un navegador, cancelación desde la
 * página del turno, revisión del panel y limpieza de los datos de prueba.
 *   node --env-file=.env.produccion node_modules/tsx/dist/cli.mjs scripts/prod-smoke.mts <url-base>
 * Requiere .env.produccion (conexión directa y SESSION_SECRET de producción).
 */
import { chromium } from "@playwright/test";
import { Client } from "pg";
import { signSession } from "../src/lib/session-token.ts";

const BASE = process.argv[2];
if (!BASE?.startsWith("https://")) throw new Error("Pasá la URL base de producción (https://…)");
const NAME = "Prueba Deploy (borrar)";
const PHONE_INPUT = "381 000 0099";
const PHONE = "+5493810000099";
const step = (msg: string) => console.log(`✓ ${msg}`);

const db = new Client({ connectionString: process.env.DIRECT_DATABASE_URL });
await db.connect();
const browser = await chromium.launch();

try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-AR" })).newPage();

  // 1) Reserva: Corte, último día con lugar, último horario.
  await page.goto(`${BASE}/martegas/reservar`);
  await page.getByRole("button", { name: /^Corte\b/ }).first().click();
  await page.getByText("¿Cuándo?").waitFor();
  const days = page.locator("button:has-text('libres')");
  await days.last().click();
  const slots = page.locator("ul.grid button");
  await slots.last().waitFor();
  const slotLabel = (await slots.last().innerText()).trim();
  await slots.last().click();
  await page.getByPlaceholder("Juan Pérez").fill(NAME);
  await page.getByPlaceholder("381 1234567").fill(PHONE_INPUT);
  await page.getByRole("button", { name: "Confirmar turno" }).click();
  await page.getByText("¡Turno confirmado!").waitFor({ timeout: 30_000 });
  const code = (await page.locator(".neon-flash p.font-mono").innerText()).trim();
  const href = await page.getByRole("link", { name: "Ver mi turno" }).getAttribute("href");
  step(`reserva confirmada a las ${slotLabel} (código de ${code.length} dígitos)`);

  const row = (await db.query('SELECT a.status, a.price, c.phone FROM "Appointment" a JOIN "Customer" c ON c.id=a."customerId" WHERE c.phone=$1', [PHONE])).rows;
  if (row.length !== 1 || row[0].status !== "CONFIRMED") throw new Error("La reserva no quedó en la base");
  step(`guardada en Neon: estado ${row[0].status}, precio ${row[0].price}, teléfono normalizado ${row[0].phone}`);

  // 2) Página del turno y cancelación online.
  await page.goto(`${BASE}${href}`);
  await page.getByText("Confirmado").first().waitFor();
  await page.getByRole("button", { name: "Cancelar turno" }).click();
  await page.getByRole("button", { name: "Sí, cancelar" }).click();
  await page.getByText("Este turno fue cancelado.").waitFor({ timeout: 30_000 });
  const after = (await db.query('SELECT a.status FROM "Appointment" a JOIN "Customer" c ON c.id=a."customerId" WHERE c.phone=$1', [PHONE])).rows[0];
  step(`cancelación online: estado en la base ${after.status}`);

  // 3) Panel de Martín con una sesión firmada (sin tipear la contraseña).
  const user = (await db.query('SELECT u.id, u."businessId", u."sessionVersion" FROM "User" u JOIN "Business" b ON b.id=u."businessId" WHERE b.slug=$1', ["martegas"])).rows[0];
  const token = await signSession({ userId: user.id, businessId: user.businessId, version: user.sessionVersion });
  await page.context().addCookies([{ name: "agendapp_session", value: token, url: BASE }]);
  await page.goto(`${BASE}/admin/clientes`);
  await page.getByRole("heading", { name: "Clientes" }).waitFor();
  await page.getByText(NAME).waitFor();
  step("panel: el cliente de prueba aparece en Clientes");
  await page.goto(`${BASE}/admin/ajustes`);
  await page.getByText("Servicios y precios").waitFor();
  step("panel: Ajustes carga");
  await page.goto(`${BASE}/martegas`);
  await page.screenshot({ path: "test-results/produccion-inicio.png", fullPage: true });
} finally {
  // 4) Limpieza: turno, cliente y registros de límite de la prueba.
  const cust = (await db.query('SELECT id FROM "Customer" WHERE phone=$1', [PHONE])).rows;
  for (const { id } of cust) {
    await db.query('DELETE FROM "Appointment" WHERE "customerId"=$1', [id]);
    await db.query('DELETE FROM "Customer" WHERE id=$1', [id]);
  }
  await db.query(`DELETE FROM "RateLimitHit" WHERE key LIKE 'booking-ip:martegas:%' AND "createdAt" > now() - interval '15 minutes'`);
  console.log(`✓ limpieza: ${cust.length} cliente(s) de prueba borrado(s)`);
  await browser.close();
  await db.end();
}
