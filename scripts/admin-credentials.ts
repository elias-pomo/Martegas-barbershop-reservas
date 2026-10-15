/**
 * Cambia el email y/o la contraseña del dueño de un negocio.
 *
 *   npm run admin:credentials -- --email nuevo@mail.com
 *   npm run admin:credentials -- --password
 *   npm run admin:credentials -- --slug martegas --email nuevo@mail.com --password
 *
 * La contraseña nunca va en la línea de comandos (quedaría en el historial): se pide
 * oculta por teclado. Para producción, correrlo con DATABASE_URL apuntando a esa base.
 * Al terminar se cierran todas las sesiones abiertas del panel.
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { MIN_PASSWORD_LENGTH, updateOwnerCredentials, validatePassword } from "../src/lib/admin-credentials";

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let muted = false;
    output._writeToOutput = (s: string) => {
      if (!muted || s.includes("\n")) output.output.write(muted ? "\n" : s);
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}

async function readPassword(): Promise<string> {
  // Sin terminal interactiva (CI, pipes) se toma de una variable de entorno.
  if (!process.stdin.isTTY) {
    const fromEnv = process.env.ADMIN_NEW_PASSWORD;
    if (!fromEnv) throw new Error("Sin terminal interactiva: definí ADMIN_NEW_PASSWORD.");
    return fromEnv;
  }
  for (;;) {
    const first = await askHidden(`Nueva contraseña (mín. ${MIN_PASSWORD_LENGTH}, letras y números): `);
    const problem = validatePassword(first);
    if (problem) {
      console.log(`✗ ${problem}`);
      continue;
    }
    const second = await askHidden("Repetila: ");
    if (first === second) return first;
    console.log("✗ No coinciden, probá de nuevo.");
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      slug: { type: "string" },
      email: { type: "string" },
      password: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help || (!values.email && !values.password)) {
    console.log(
      [
        "Uso: npm run admin:credentials -- [--slug <negocio>] [--email <nuevo>] [--password]",
        "",
        "  --slug       negocio (por defecto DEFAULT_BUSINESS_SLUG)",
        "  --email      nuevo email para entrar al panel",
        "  --password   pide una contraseña nueva (oculta)",
      ].join("\n"),
    );
    process.exit(values.help ? 0 : 1);
  }

  const slug = values.slug ?? process.env.DEFAULT_BUSINESS_SLUG;
  if (!slug) throw new Error("Indicá --slug o definí DEFAULT_BUSINESS_SLUG.");

  const host = new URL(process.env.DATABASE_URL ?? "postgres://?").host || "(sin DATABASE_URL)";
  console.log(`Base: ${host} · Negocio: ${slug}`);

  const password = values.password ? await readPassword() : undefined;
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const result = await updateOwnerCredentials(db, { slug, email: values.email, password });
    if (!result.ok) {
      console.error(`✗ ${result.message}`);
      process.exitCode = 1;
      return;
    }
    console.log(`✓ Listo. Email del panel: ${result.email}${password ? " · contraseña actualizada" : ""}`);
    console.log("  Se cerraron las sesiones abiertas: hay que volver a ingresar.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
