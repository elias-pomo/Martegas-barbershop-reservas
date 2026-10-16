import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { businessSettingsSchema } from "../src/lib/domain/settings";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const SLUG = "martegas";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Definí SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD en .env para crear el usuario del panel.");
  }

  const existing = await db.business.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`El negocio "${SLUG}" ya existe; no se modifica.`);
    return;
  }

  const settings = businessSettingsSchema.parse({ defaultAreaCode: "381" });

  const business = await db.business.create({
    data: {
      slug: SLUG,
      name: "Martega's Barber Shop",
      timezone: "America/Argentina/Tucuman",
      address: "Lavalle 864, San Miguel de Tucumán",
      mapsUrl: "https://www.google.com/maps/search/?api=1&query=Lavalle+864+San+Miguel+de+Tucum%C3%A1n",
      whatsapp: "+34641311213",
      instagram: "https://www.instagram.com/martindiaz7_",
      // Placeholder hasta que el barbero pase los datos reales (se edita desde Ajustes).
      paymentAlias: "martegas.barber",
      paymentHolder: "Titular a confirmar",
      theme: { background: "#0a0a0b", primary: "#8b5cf6", accent: "#22c55e" },
      settings,
      users: {
        create: { email, passwordHash: await hashPassword(password), role: "OWNER" },
      },
      services: {
        create: [
          {
            name: "Corte",
            description: "Corte a tu medida, a tijera o máquina, con terminación y peinado.",
            durationMin: 60,
            price: 12000,
            sortOrder: 0,
          },
          {
            name: "Corte + barba",
            description: "Corte completo más perfilado y arreglo de barba con navaja.",
            durationMin: 90,
            price: 15000,
            sortOrder: 1,
          },
        ],
      },
    },
    include: { services: true },
  });

  await db.staff.create({
    data: {
      businessId: business.id,
      name: "Martín",
      services: { create: business.services.map((s) => ({ serviceId: s.id })) },
      // Lunes (1) a sábado (6), primer inicio 15:00, último inicio 22:00.
      workingHours: {
        create: [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, firstStart: "15:00", lastStart: "22:00" })),
      },
    },
  });

  console.log(`Negocio "${business.name}" creado. Panel: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
