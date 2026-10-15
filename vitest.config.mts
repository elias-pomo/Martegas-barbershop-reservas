import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "server-only": src("test/empty.ts"),
      "next/cache": src("test/next-cache.ts"),
      "@": src(""),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Los tests de integración usan la base local (DATABASE_URL); se saltean si no hay.
    setupFiles: ["dotenv/config"],
    fileParallelism: false,
  },
});
