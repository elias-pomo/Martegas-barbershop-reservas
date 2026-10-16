@AGENTS.md

# Agendapp — contexto para Claude

Sistema de turnos online, mobile-first y multi-negocio. Primer cliente en producción: **Martega's Barber Shop**
(barbero Martín Díaz, Lavalle 864, San Miguel de Tucumán, usa iPhone).

- Reglas de negocio, datos del negocio y modelo de datos: [docs/PLAN.md](docs/PLAN.md). Es la fuente de verdad.
- Setup local, scripts y deploy: [README.md](README.md).

## Cómo trabajar con el usuario

- Desarrollador freelance en Argentina. Hablarle en **español rioplatense (voseo)**. Conoce React y Express.
- Prefiere validar reglas y proponer antes de programar cosas grandes. Para cambios chicos: hacerlo directo.
- Commits en español, descriptivos. Hacer commit cuando lo pide; el push dispara el deploy de producción.
- Textos de la app en español de Argentina, voseo ("Reservá", "Elegí").
- Código y nombres **genéricos** (Business, Staff, Service), nada de barbería hardcodeado: todo lo del negocio va en la base o
  en la configuración, porque el producto se va a reutilizar en otros rubros.

## Estado (octubre 2026)

- M1–M7 terminados. **Período de prueba en producción** con Martega's; después se pasa a producción real.
- Producción: https://martegas.vercel.app (también responde barber-shop-reservas.vercel.app). La raíz redirige a `/martegas`.
  Panel del barbero en `/admin` (se instala como PWA desde Safari → Compartir → Agregar a inicio).
- Repo: https://github.com/elias-pomo/Martegas-barbershop-reservas (rama `main`).

### Infraestructura

- **Vercel** (plan Hobby): proyecto `barber-shop-reservas`, región `gru1` (`vercel.json`). Deploy automático al pushear `main`.
  Protección de deploy solo en previews. Variables cargadas: DATABASE_URL (pooled), DATABASE_POOL_MAX, DEFAULT_BUSINESS_SLUG,
  SESSION_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
- **Neon**: proyecto "Agendapp" (`silent-credit-67808807`, aws-sa-east-1), rama `production`, base `neondb`.
  La app usa la conexión pooled (`-pooler`); migraciones y seed usan la directa. Extensión `btree_gist` activa.
- Neon MCP y skill configurados en `.mcp.json` y `.claude/skills/neon` (el MCP pide OAuth en cada máquina).

### Archivos que NO están en git (copiarlos a mano, por un canal seguro)

- `.env`: base local (`prisma dev`), SESSION_SECRET y VAPID locales, `SEED_ADMIN_*`, `DATABASE_POOL_MAX="1"`.
  Si no está, se arma desde `.env.example`.
- `.env.produccion`: conexiones de Neon (pooled y directa) y secretos de producción. Lo usan `npm run db:prod:*`
  y `scripts/prod-smoke.mts`. **No renombrarlo a `.env.production*`**: Next lo cargaría solo en el build.
- `.env.vercel`: copia de las variables de Vercel.

### Primeros pasos en otra computadora

1. Node 22+. `npm install` (corre `prisma generate`).
2. Copiar los `.env*` de arriba. Si falta `.env`: `npm run db:dev`, `npx prisma dev ls` para ver las URLs y completar
   DATABASE_URL y SHADOW_DATABASE_URL (PGlite tiene una sola base, por eso la shadow aparte).
3. `npm run db:migrate && npm run db:seed && npm run dev`.
4. Verificar: `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:responsive` (Playwright: `npx playwright install chromium`).

## Stack y trampas conocidas

- **Next.js 16.4** con `cacheComponents`: los datos de runtime van dentro de `<Suspense>` o después de `connection()`.
  `proxy.ts` reemplaza a middleware. Tipos `PageProps`/`LayoutProps` generados por `next typegen`.
  Leer `node_modules/next/dist/docs/` antes de usar APIs que no conozcas (ver AGENTS.md).
- Con streaming, una página siempre responde 200 aunque falle adentro: al verificar, mirar el contenido, no el status.
- `getBusinessBySlug` usa `"use cache"` con `cacheTag` y `cacheLife` corto (60 s). Los servicios se leen frescos al reservar.
- **Prisma 7.10**: generator `prisma-client` con salida en `src/generated/prisma`, adapter `@prisma/adapter-pg`, config en
  `prisma.config.ts` (permite `prisma generate` sin URL, para el build de Vercel). Después de migrar, reiniciar el dev server.
- Restricción `appointment_no_overlap` (EXCLUDE con btree_gist sobre `tstzrange`) impide turnos superpuestos del mismo
  profesional a nivel base. Columnas de fecha en `timestamptz`.
- Local con PGlite: `DATABASE_POOL_MAX=1` o se cortan conexiones.
- Fuentes locales (`src/app/fonts`, `assets/fonts` para la imagen OG): no depender de Google Fonts en el build.
- Inputs a 16px (si no, iOS hace zoom). Evitar scroll lateral: `npm run test:responsive` lo controla en 5 anchos.
- Lecturas de `localStorage` solo dentro de efectos (si no, hay error de hidratación).
- Si el dev server sirve CSS viejo: borrar `.next/dev` y reiniciar.

## Datos del negocio en producción

Dirección, horarios, servicios, precios y alias se leen de la base, no del código. Se cambian desde el panel
(Ajustes) o con SQL sobre Neon. Cambiar `prisma/seed.ts` solo afecta bases nuevas.
Ejemplo: la imagen al compartir el link (`src/app/[slug]/opengraph-image.tsx`) muestra la dirección guardada en la base.

## Pendientes para producción real

1. Dejar Vercel Hobby (no permite uso comercial): Railway (recomendado) o Vercel Pro, manteniendo Neon.
2. Rotar SESSION_SECRET, la contraseña de Neon y las claves VAPID (pasaron por un chat).
3. Cargar el alias y el titular reales de la transferencia (hoy `martegas.barber`, genérico).
4. Confirmar que Martín cambió su contraseña inicial (Ajustes → Cuenta, o `npm run admin:credentials`).
5. Repo de GitHub privado.

## Estrategia de producto (decidida con el usuario)

- Llevar Agendapp a otros rubros (estéticas, manicura, canchas de fútbol 5, centros médicos).
- Recomendación: **un solo producto multi-negocio** con funciones activables por negocio, no un repo por cliente.
  Un repo aparte solo para un cliente con desarrollo muy a medida.
- Orden sugerido: estética configurable por negocio (hoy el neón de Martega's está fijo en `globals.css`) →
  demos (`demo-estetica`, `demo-canchas`) con datos inventados → funciones de rubro (seña, varias canchas,
  turnos fijos) recién con el primer cliente que pague. Centros médicos al final (Ley 25.326, no guardar datos clínicos).
- Ese trabajo va en una rama o sesión aparte para no afectar a Martega's durante la prueba.
