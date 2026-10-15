# Agendapp

Sistema de turnos online, mobile-first y multi-negocio. Primer cliente: Martega's Barber Shop.
Plan completo, reglas de negocio y modelo de datos en [docs/PLAN.md](docs/PLAN.md).

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind 4 · Prisma 7 + PostgreSQL · Vitest

## Desarrollo local

```bash
npm install
npm run db:dev        # levanta Postgres local (Prisma Dev) en segundo plano
cp .env.example .env  # completar DATABASE_URL / SHADOW_DATABASE_URL con los que imprime db:dev
npm run db:migrate    # aplica migraciones
npm run db:seed       # carga Martega's + usuario del panel (SEED_ADMIN_*)
npm run dev
```

`npx prisma dev ls` muestra las URLs del servidor local. Prisma Dev usa PGlite, que tiene una sola base: por eso hace falta `SHADOW_DATABASE_URL` apuntando al puerto de shadow que informa el servidor.

## Scripts

| Script | Qué hace |
|---|---|
| `npm test` | Tests de dominio + integración contra la base local (se saltean sin `DATABASE_URL`) |
| `npm run typecheck` | Chequeo de tipos |
| `npm run lint` | ESLint |
| `npm run db:studio` | Explorador visual de la base |

## Estructura

```
prisma/                 schema, migraciones (incluye restricción anti-superposición) y seed
src/lib/domain/         lógica de negocio pura y testeada (disponibilidad, reglas, teléfonos, WhatsApp)
src/lib/                acceso a datos (db, business)
src/app/[slug]/         páginas públicas de cada negocio
src/app/admin/          panel del barbero (login en /admin/login)
src/proxy.ts            redirige al login si no hay sesión
```

## Deploy (Vercel)

1. Crear la base en Neon (o desde el Marketplace de Vercel) y cargar `DATABASE_URL` en el proyecto.
2. Cargar `DEFAULT_BUSINESS_SLUG`, `SESSION_SECRET` (32+ caracteres aleatorios), `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`.
3. Ejecutar `npm run db:deploy` y `npm run db:seed` contra esa base.
