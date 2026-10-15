// Corre antes de los comandos db:prod:*. Frena si .env.production.local está incompleto
// o apunta a una base local, para no migrar ni sembrar la base equivocada.
const problems = [];
const direct = process.env.DIRECT_DATABASE_URL ?? "";
const pooled = process.env.DATABASE_URL ?? "";

if (!direct) problems.push("Falta DIRECT_DATABASE_URL (conexión directa de Neon, sin -pooler).");
if (!pooled) problems.push("Falta DATABASE_URL (conexión pooled de Neon, con -pooler).");
for (const [name, url] of [["DIRECT_DATABASE_URL", direct], ["DATABASE_URL", pooled]]) {
  if (/localhost|127\.0\.0\.1|REEMPLAZAR/i.test(url)) problems.push(`${name} todavía apunta a local o tiene el valor de ejemplo.`);
}
if (direct.includes("-pooler")) problems.push("DIRECT_DATABASE_URL no debe ser la conexión -pooler.");

if (problems.length) {
  console.error("✗ .env.production.local no está listo:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log(`Base de producción: ${new URL(direct).host}`);
