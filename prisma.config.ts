import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Configuración del CLI de Prisma (migraciones, seed, studio). La app en ejecución usa
 * DATABASE_URL desde src/lib/db.ts.
 * En producción con Neon: DATABASE_URL = conexión "pooled" (host con -pooler) para la app,
 * y DIRECT_DATABASE_URL = conexión directa para migraciones (el pooler no las soporta bien).
 */
const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Sin URL (p. ej. `prisma generate` en el build de Vercel, que no se conecta) no se
  // declara datasource; los comandos que sí se conectan avisan que falta la variable.
  ...(databaseUrl && {
    datasource: {
      url: process.env.DIRECT_DATABASE_URL ? env("DIRECT_DATABASE_URL") : env("DATABASE_URL"),
      ...(process.env.SHADOW_DATABASE_URL && { shadowDatabaseUrl: env("SHADOW_DATABASE_URL") }),
    },
  }),
});
