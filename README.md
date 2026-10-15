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
| `npm run test:responsive` | Recorre todas las pantallas en 5 anchos de celular (320–414 px) y falla si hay scroll lateral |
| `npm run capturas` | Capturas de todas las pantallas en tamaño iPhone (`test-results/capturas`) |
| `npm run typecheck` | Chequeo de tipos |
| `npm run lint` | ESLint |
| `npm run db:studio` | Explorador visual de la base |
| `npm run admin:credentials` | Cambia email y/o contraseña del dueño del panel (ver abajo) |

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

1. Crear la base en Neon (o desde el Marketplace de Vercel). En Vercel cargar:
   - `DATABASE_URL`: la conexión **pooled** (host con `-pooler`), la que usa la app.
   - `DATABASE_POOL_MAX`: `3` (conexiones por instancia; Vercel abre muchas en paralelo).
2. Cargar `DEFAULT_BUSINESS_SLUG`, `SESSION_SECRET` (32+ caracteres aleatorios), `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`.
3. Completar `.env.production.local` (ignorado por git) con las conexiones de Neon y ejecutar desde tu PC
   `npm run db:prod:migrate` y `npm run db:prod:seed`. Esos comandos se niegan a correr si el archivo está
   incompleto o apunta a una base local. La primera migración también confirma que Neon acepta `btree_gist`.
   `vercel.json` fija las funciones en São Paulo (`gru1`): crear la base de Neon en la misma región (`aws-sa-east-1`).
4. **Uso comercial:** Vercel Hobby es solo para uso no comercial. Para probar con amigos sirve; con clientes reales,
   pasar a Vercel Pro u otro hosting.
5. Avisos push (opcional): generar claves con `npx web-push generate-vapid-keys` y cargar
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (`mailto:tu-email`). Sin ellas la app funciona igual, sin avisos.

## Avisos al barbero (PWA)

- El panel se instala como app (`/panel.webmanifest`) y cada negocio tiene su manifest para clientes (`/<slug>/manifest.webmanifest`).
- `public/sw.js` solo maneja notificaciones push (no cachea: la app no funciona offline).
- **iPhone:** iOS 16.4+ y el panel instalado desde Safari con *Compartir → Agregar a inicio*. Desde la app instalada:
  *Ajustes → Avisos en este celular → Activar avisos*.
- Push necesita HTTPS: en local funciona en `localhost` con Chrome/Edge; en el celular, recién con el sitio publicado.

## Cambiar email o contraseña del panel

```bash
npm run admin:credentials -- --email nuevo@mail.com      # solo email
npm run admin:credentials -- --password                  # pide la contraseña oculta
npm run admin:credentials -- --slug martegas --email x@y.com --password
```

- La contraseña se pide por teclado (no queda en el historial). Mínimo 10 caracteres, con letras y números.
- **En producción:** correrlo desde tu PC con `DATABASE_URL` apuntando a la base de producción, por ejemplo
  `DATABASE_URL="postgresql://…" npm run admin:credentials -- --password`. Antes de cambiar nada muestra a qué base se conecta.
- Al terminar se cierran todas las sesiones abiertas del panel.
