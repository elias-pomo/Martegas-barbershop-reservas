# Agendapp — Plan de desarrollo (MVP)

Sistema de turnos online, mobile-first, multi-negocio desde el diseño.
Primer cliente: **Martega's Barber Shop**.

---

## 1. Datos del negocio (seed inicial)

| Campo | Valor |
|---|---|
| Nombre | Martega's Barber Shop |
| Slug | `martegas` |
| Dirección | Lavalle 864, San Miguel de Tucumán |
| Zona horaria | `America/Argentina/Tucuman` |
| WhatsApp del barbero | +34 641 311 213 → `wa.me/34641311213` (número español, intencional) |
| Instagram | https://www.instagram.com/martindiaz7_ |
| Pagos | Efectivo o transferencia — alias genérico `martegas.barber` (placeholder hasta tener el real) |
| Profesionales | 1 barbero |
| Colores | Negro (fondo), morado (primario), verde (disponible / confirmado) |
| Logo | No tiene → wordmark tipográfico |

### Servicios

| Servicio | Duración | Precio |
|---|---|---|
| Corte | 60 min | $12.000 |
| Corte + barba | 90 min | $15.000 |

Precios editables desde el panel.

---

## 2. Reglas de negocio (definitivas)

| # | Regla |
|---|---|
| R1 | Atención regular: **lunes a sábado**. Primer inicio 15:00, **último inicio 22:00**. |
| R2 | Turnos **cada 1 hora** en punto (15, 16, … 22 → 8 inicios por día). Un corte + barba ocupa 90 min y bloquea el inicio siguiente; los 30 min sobrantes quedan libres para el barbero. |
| R3 | **Ventana de reserva:** solo la semana en curso (lun–sáb). El **domingo a las 00:00** se habilita la semana siguiente. En la práctica: se puede reservar desde ahora hasta el próximo sábado inclusive. |
| R4 | **Anticipación mínima:** 15 min antes del inicio del turno. |
| R5 | **Límite por persona** (identificada por teléfono), por semana calendario (lun–dom): 1 turno; máximo 2 si hay **≥ 2 días** de diferencia (lunes y miércoles ✅, lunes y martes ❌). Solo cuentan los turnos activos o asistidos. |
| R6 | **Cancelación online** hasta **5 hs antes**. Después, solo por WhatsApp con el barbero, y la **cancelación tardía cuenta como falta**. |
| R7 | **Faltas:** solo se cuentan, sin penalidad. Con **10 faltas o más**, el cliente no puede reservar online y se le muestra el botón de WhatsApp. |
| R8 | **Turnos especiales** (fuera de horario, incluidos domingos, o a domicilio, con varios cortes seguidos): se piden por un formulario que arma el mensaje de WhatsApp. Precio y recargo se acuerdan con el barbero (referencia: +$3.000 por persona fuera de horario). El barbero lo carga en el panel con el precio acordado. Estos turnos no cuentan para el límite R5. |
| R9 | **Carga manual del barbero:** puede saltear todas las reglas (ventana, límite, faltas). Cubre los casos en que alguien reserva para otra persona. |
| R10 | **Asistencia automática:** al terminar el turno, si sigue "confirmado", cuenta como **asistió**. El barbero solo marca "No vino" o "Canceló tarde". |
| R11 | Datos pedidos al cliente: **nombre y teléfono**, con una línea de aviso de privacidad (Ley 25.326). |

### Teléfonos
- El cliente escribe como le sale (`381 1234567`, `0381 15 1234567`, `+54 9 381…`).
- Se normaliza a E.164 argentino (`+5493811234567`) con `libphonenumber-js` (país por defecto AR). Ese valor es la identidad del cliente.

---

## 3. Funcionalidades del MVP

### Cliente (sin cuenta)
1. **Inicio:** nombre, dirección (link a Maps), botón "Reservar turno", "Mis turnos" y "Turno especial".
2. **Reserva:** servicio → día (chips deslizables) → hora (grilla) → nombre + teléfono → confirmación.
3. **Confirmación:**
   - Resumen, precio y alias para transferencia.
   - **Agregar a calendario:** archivo `.ics` con alarmas (1 día y 2 hs antes) y link de Google Calendar.
   - **Código de 4 dígitos** y link al turno.
   - El turno queda guardado en el dispositivo.
4. **Mis turnos / cancelar (problema D):**
   - Vía principal: **link con token** (incluido en el evento del calendario y en "Mis turnos" del dispositivo).
   - Respaldo: **teléfono + código de 4 dígitos**. Máximo 5 intentos cada 15 min por teléfono.
   - Con menos de 5 hs de anticipación, en lugar de "Cancelar" aparece "Avisale por WhatsApp".
5. **Turno especial:** formulario (tipo, fecha y hora deseadas, cantidad de personas, dirección si es domicilio) que abre WhatsApp con el mensaje armado.

### Panel del barbero (PWA, navegación inferior)
- **Hoy:** línea de tiempo del día. Por turno: WhatsApp (recordatorio armado), "No vino", "Canceló tarde", "Cancelar".
- **Agenda:** vista semanal. Tocar un hueco para cargar un turno (regular o especial, con precio libre) o bloquear un horario o día.
- **Clientes:** buscador y tabla (nombre, teléfono, asistencias, faltas, último turno, botón de WhatsApp). Al tocar uno se ve su detalle e historial.
- **Ajustes:** horarios por día, servicios y precios, políticas (R3–R7), datos del negocio, alias.
- **Notificación push** al barbero cuando alguien reserva o cancela. En iPhone requiere instalar la PWA (iOS 16.4+).
- **Cancelación por parte del barbero:** al cancelar o bloquear un día con turnos, arma los WhatsApp para avisar a cada afectado.

### Mensajes de WhatsApp (plantillas editables)
- Recordatorio: "Hola {nombre}! Te recuerdo tu turno de {servicio} hoy a las {hora} en Martega's Barber Shop, Lavalle 864. ¡Te espero!"
- Cancelación del barbero: "Hola {nombre}, tuve un imprevisto y tengo que cancelar tu turno del {día} a las {hora}. Podés reservar otro en {link}. Disculpá!"
- Genérico: "Hola {nombre}! "
- Link: `https://wa.me/5493811234567?text=...` (cliente) / `wa.me/34641311213` (barbero).

---

## 4. Arquitectura

| Capa | Elección |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui + Framer Motion + lucide-react |
| DB | PostgreSQL (Neon, integración con Vercel) |
| ORM | Prisma (+ una migración SQL a mano para la restricción de exclusión) |
| Validación | Zod |
| Auth del panel | Auth.js con credenciales (usuario inicial por seed) |
| Fechas | date-fns + @date-fns/tz |
| Teléfonos | libphonenumber-js |
| Push | web-push (VAPID) + service worker de la PWA |
| Tests | Vitest (motor de disponibilidad y reglas) |
| Hosting (prueba) | Vercel Hobby + Neon free. Antes de usarlo con clientes reales: Vercel Pro u otro hosting (Hobby es solo para uso no comercial) |

**Sin cron jobs:** la asistencia automática (R10) se calcula al leer los datos (un turno vencido en estado "confirmado" se toma como asistido) y se persiste al cargar el panel. Así funciona en Vercel Hobby.

### Rutas
```
/                         → redirige al negocio por defecto (env DEFAULT_BUSINESS_SLUG)
/[slug]                   inicio del negocio
/[slug]/reservar          flujo de reserva (pasos)
/[slug]/turno/[token]     detalle + cancelar
/[slug]/mis-turnos        turnos del dispositivo + búsqueda por teléfono y código
/[slug]/especial          formulario de turno especial → WhatsApp
/admin/login
/admin                    Hoy
/admin/agenda
/admin/clientes  /admin/clientes/[id]
/admin/ajustes
```

---

## 5. Modelo de datos

```
Business      id, slug (unique), name, timezone, address, mapsUrl, whatsapp,
              instagram?, paymentAlias?, paymentHolder?, theme (json), settings (json)
              settings: { slotIntervalMin: 60, minLeadMin: 15, cancelMinHours: 5,
                          maxPerWeek: 2, minDaysBetween: 2, noShowBlockThreshold: 10,
                          weekOpensOn: "SUNDAY_00", specialSurchargePerPerson: 3000,
                          labels: { staff: "barbero", ... }, waTemplates: {...} }
User          id, businessId, email, passwordHash, role (OWNER | STAFF)
Staff         id, businessId, name, active
Service       id, businessId, name, durationMin, price, active, sortOrder
StaffService  staffId, serviceId
WorkingHours  id, staffId, weekday (0-6), firstStart "15:00", lastStart "22:00"
TimeOff       id, staffId, startsAt, endsAt, reason?
Customer      id, businessId, name, phone (E.164), createdAt
              unique(businessId, phone)
Appointment   id, businessId, staffId, serviceId?, customerId,
              type (REGULAR | SPECIAL), startsAt, endsAt,
              status (CONFIRMED | ATTENDED | NO_SHOW | LATE_CANCEL |
                      CANCELLED_BY_CUSTOMER | CANCELLED_BY_BUSINESS),
              price, notes?, address?, people?,
              cancelToken (unique), cancelCodeHash, createdBy (CUSTOMER | ADMIN),
              createdAt, cancelledAt?
PushSubscription  id, userId, endpoint, keys (json)
CancelAttempt     id, phone, createdAt                 (rate limit)
```

- **Anti superposición (en la DB):**
  `EXCLUDE USING gist (staff_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status IN ('CONFIRMED','ATTENDED'))`
- **Contadores de clientes:** se calculan con `COUNT` agrupado por estado (asistencias = ATTENDED; faltas = NO_SHOW + LATE_CANCEL).

---

## 6. Motor de disponibilidad (núcleo, con tests)

Para cada día dentro de la ventana R3:
1. Si hay horario laboral ese día, generar inicios cada `slotIntervalMin` desde `firstStart` hasta `lastStart`.
2. Por cada inicio, armar el rango `[inicio, inicio + duración del servicio)`.
3. Descartar si `inicio < ahora + 15 min` (R4).
4. Descartar si se superpone con un turno activo o un `TimeOff`.

Validaciones al confirmar (server action, en una transacción):
ventana R3 → anticipación R4 → faltas < 10 (R7) → límite semanal R5 → insert (la restricción de exclusión resuelve las carreras; si falla, responde "ese horario se acaba de ocupar").

Casos de test clave: domingo 00:00 (cambio de ventana), sábado 21:50, corte + barba que bloquea el inicio siguiente, lun+mié permitido, lun+mar rechazado, tercer turno en la semana, cliente con 10 faltas, cancelación a 5h01 y a 4h59, zona horaria de Tucumán.

---

## 7. Hitos

| Hito | Contenido | Horas aprox. |
|---|---|---|
| M0 | Setup Next + Tailwind + shadcn + Prisma + Neon, deploy temprano en Vercel | 6 |
| M1 | Schema, migraciones, seed de Martega's, motor de disponibilidad + reglas + tests | 16 |
| M2 | Flujo público de reserva + confirmación | 18 |
| M3 | Mis turnos, cancelación (token / código), `.ics` y Google Calendar, turno especial | 10 |
| M4 | Auth del panel, Hoy, Agenda, carga manual, bloqueos | 20 |
| M5 | Clientes + Ajustes + plantillas de WhatsApp | 12 |
| M6 | PWA, push al barbero, pulido visual y animaciones | 12 |
| M7 | Prueba con amigos en Vercel y ajustes | 10 |
| | **Total** | **~104 hs** |

---

## 8. Comercial (modelo A)

- **Setup:** USD 300–450 (convertir al dólar MEP o blue del día de la propuesta).
- **Abono mensual:** USD 20–25 (hosting, dominio, soporte y cambios menores). Actualizar trimestralmente si se cobra en pesos.
- **Costos propios estimados en producción:** ~USD 6–10 por mes (más Vercel Pro USD 20 si se queda en Vercel; conviene cuando haya varios negocios).
- **Contrato:** el código es del desarrollador; el negocio recibe una licencia de uso. Los datos y la marca son del negocio.

---

## 9. Fuera del MVP (fase 2+)
- Recordatorios automáticos por la API de WhatsApp (Meta).
- Reprogramar el turno sin cancelar.
- Seña con Mercado Pago.
- Varios profesionales con selector.
- Estadísticas (ingresos, ocupación, horarios pico).
- Panel super-admin para alta de negocios (SaaS) y dominios propios.

## 10. Pendientes del cliente
- [ ] Alias y titular reales para transferencias (hoy placeholder, se cambia desde Ajustes)
- [x] Instagram
- [x] Ciudad: San Miguel de Tucumán
- [x] El barbero usa iPhone → la push requiere instalar la PWA (iOS 16.4+); incluir instructivo de instalación en el panel
