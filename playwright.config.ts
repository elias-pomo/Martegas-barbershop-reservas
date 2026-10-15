import { defineConfig } from "@playwright/test";

/** Pruebas en navegador real (responsive). Usan el servidor de desarrollo y la base local. */
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  // Las capturas solo se generan cuando se piden (--grep @capturas).
  grepInvert: process.argv.some((a) => a.includes("@capturas")) ? undefined : /@capturas/,
  use: {
    baseURL: "http://localhost:3000",
    locale: "es-AR",
    timezoneId: "America/Argentina/Tucuman",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/martegas",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
