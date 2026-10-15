import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import type { Admin } from "./auth";
import { hashCancelCode, isOverlapViolation } from "./booking";
import { db } from "./db";
import { buildDayTimeline } from "./domain/agenda";
import { normalizePhone } from "./domain/phone";
import { ACTIVE_STATUSES, NO_SHOW_STATUSES, type AppointmentStatus } from "./domain/rules";
import { addLocalDays, atLocalTime, weekStartOf } from "./domain/time";

type Business = Admin["business"];

const dayRange = (business: Business, day: string) => ({
  from: atLocalTime(day, "00:00", business.timezone),
  to: atLocalTime(addLocalDays(day, 1), "00:00", business.timezone),
});

/** R10: los turnos confirmados que ya terminaron pasan a "asistió" (se persiste al abrir el panel). */
export async function persistAttended(businessId: string, now = new Date()) {
  await db.appointment.updateMany({
    where: { businessId, status: "CONFIRMED", endsAt: { lte: now } },
    data: { status: "ATTENDED" },
  });
}

export async function getDayAgenda(business: Business, day: string, now = new Date()) {
  const { from, to } = dayRange(business, day);

  const [staff, services, appointments, blocks] = await Promise.all([
    db.staff.findMany({ where: { businessId: business.id, active: true }, include: { workingHours: true } }),
    db.service.findMany({ where: { businessId: business.id, active: true }, select: { durationMin: true } }),
    db.appointment.findMany({
      where: { businessId: business.id, startsAt: { gte: from, lt: to } },
      include: { customer: true, service: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
    }),
    db.timeOff.findMany({
      where: { staff: { businessId: business.id }, startsAt: { lt: to }, endsAt: { gt: from } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  // Faltas de cada cliente del día, para mostrarlas en la tarjeta.
  const customerIds = [...new Set(appointments.map((a) => a.customerId))];
  const noShows = customerIds.length
    ? await db.appointment.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds }, status: { in: [...NO_SHOW_STATUSES] } },
        _count: true,
      })
    : [];
  const noShowsBy = new Map(noShows.map((n) => [n.customerId, n._count]));

  const timeline = buildDayTimeline({
    day,
    timeZone: business.timezone,
    workingHours: staff.flatMap((s) => s.workingHours),
    slotIntervalMin: business.settings.slotIntervalMin,
    minDurationMin: Math.min(60, ...services.map((s) => s.durationMin)),
    now,
    appointments: appointments.map((a) => ({
      id: a.id,
      start: a.startsAt,
      end: a.endsAt,
      active: (ACTIVE_STATUSES as readonly string[]).includes(a.status),
      status: a.status as AppointmentStatus,
      type: a.type,
      token: a.cancelToken,
      price: a.price,
      notes: a.notes,
      address: a.address,
      people: a.people,
      serviceName: a.service?.name ?? "Turno especial",
      customer: { id: a.customer.id, name: a.customer.name, phone: a.customer.phone },
      customerNoShows: noShowsBy.get(a.customerId) ?? 0,
    })),
    blocks: blocks.map((b) => ({ id: b.id, start: b.startsAt, end: b.endsAt, reason: b.reason })),
  });

  return timeline;
}

/** Cantidad de turnos activos por día de la semana que contiene `day`. */
export async function getWeekCounts(business: Business, day: string) {
  const start = weekStartOf(day, business.settings.weekStartsOn);
  const days = Array.from({ length: 7 }, (_, i) => addLocalDays(start, i));
  const { from } = dayRange(business, days[0]);
  const { to } = dayRange(business, days[6]);

  const rows = await db.appointment.findMany({
    where: { businessId: business.id, status: { in: [...ACTIVE_STATUSES] }, startsAt: { gte: from, lt: to } },
    select: { startsAt: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    const d = r.startsAt.toLocaleDateString("en-CA", { timeZone: business.timezone });
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return days.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

/* ---------- Acciones sobre turnos ---------- */

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; message: string };

const TRANSITIONS: Record<string, AppointmentStatus[]> = {
  CONFIRMED: ["NO_SHOW", "LATE_CANCEL", "CANCELLED_BY_BUSINESS"],
  ATTENDED: ["NO_SHOW", "LATE_CANCEL"],
  NO_SHOW: ["ATTENDED"],
  LATE_CANCEL: ["ATTENDED"],
};

export async function setAppointmentStatus(
  business: Business,
  id: string,
  status: AppointmentStatus,
  now = new Date(),
): Promise<ActionResult> {
  const appointment = await db.appointment.findFirst({ where: { id, businessId: business.id } });
  if (!appointment) return { ok: false, message: "Turno no encontrado." };

  // "Deshacer" una falta vuelve a confirmado si el turno todavía no terminó.
  const target = status === "ATTENDED" && appointment.endsAt > now ? "CONFIRMED" : status;
  if (!TRANSITIONS[appointment.status]?.includes(status)) {
    return { ok: false, message: "No se puede cambiar el turno a ese estado." };
  }

  try {
    await db.appointment.update({
      where: { id },
      data: {
        status: target,
        cancelledAt: target.startsWith("CANCELLED") || target === "LATE_CANCEL" ? now : null,
      },
    });
  } catch (e) {
    if (isOverlapViolation(e)) return { ok: false, message: "Ese horario ya fue ocupado por otro turno." };
    throw e;
  }
  return { ok: true };
}

export interface ManualAppointmentInput {
  day: string;
  time: string;
  type: "REGULAR" | "SPECIAL";
  serviceId?: string;
  durationMin: number;
  price: number;
  people: number;
  address?: string;
  notes?: string;
  name: string;
  phone: string;
}

/** Turno cargado por el barbero: saltea las reglas públicas (R9), solo respeta que no se superponga. */
export async function createManualAppointment(
  business: Business,
  input: ManualAppointmentInput,
): Promise<ActionResult<{ token: string; code: string; startsAt: string; phone: string }>> {
  const phone = normalizePhone(input.phone, business.settings.defaultAreaCode);
  if (!phone) return { ok: false, message: "Revisá el teléfono." };

  const staff = await db.staff.findFirst({ where: { businessId: business.id, active: true }, orderBy: { name: "asc" } });
  if (!staff) return { ok: false, message: "No hay profesionales activos." };

  if (input.serviceId) {
    const service = await db.service.findFirst({ where: { id: input.serviceId, businessId: business.id } });
    if (!service) return { ok: false, message: "Servicio no encontrado." };
  }

  const startsAt = atLocalTime(input.day, input.time, business.timezone);
  const endsAt = new Date(startsAt.getTime() + input.durationMin * 60_000);
  const token = randomBytes(24).toString("base64url");
  const code = randomInt(0, 10_000).toString().padStart(4, "0");
  const name = input.name.trim().replace(/\s+/g, " ");

  try {
    await db.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { businessId_phone: { businessId: business.id, phone } },
        create: { businessId: business.id, phone, name },
        update: { name },
      });
      await tx.appointment.create({
        data: {
          businessId: business.id,
          staffId: staff.id,
          serviceId: input.type === "REGULAR" ? input.serviceId : null,
          customerId: customer.id,
          type: input.type,
          startsAt,
          endsAt,
          price: input.price,
          people: input.people,
          address: input.address?.trim() || null,
          notes: input.notes?.trim() || null,
          cancelToken: token,
          cancelCodeHash: hashCancelCode(token, code),
          createdBy: "ADMIN",
        },
      });
    });
  } catch (e) {
    if (isOverlapViolation(e)) return { ok: false, message: "Se superpone con otro turno de ese horario." };
    throw e;
  }

  return { ok: true, token, code, startsAt: startsAt.toISOString(), phone };
}

/* ---------- Bloqueos ---------- */

export interface BlockInput {
  day: string;
  allDay: boolean;
  from?: string;
  to?: string;
  reason?: string;
  /** Si hay turnos en el rango, cancelarlos (el barbero ya confirmó). */
  cancelConflicts: boolean;
}

export interface ConflictInfo {
  id: string;
  startsAt: string;
  token: string;
  customerName: string;
  phone: string;
  serviceName: string;
}

export async function createBlock(
  business: Business,
  input: BlockInput,
  now = new Date(),
): Promise<ActionResult<{ conflicts: ConflictInfo[]; blocked: boolean }>> {
  const start = atLocalTime(input.day, input.allDay ? "00:00" : input.from!, business.timezone);
  const end = input.allDay
    ? atLocalTime(addLocalDays(input.day, 1), "00:00", business.timezone)
    : atLocalTime(input.day, input.to!, business.timezone);
  if (end <= start) return { ok: false, message: "La hora de fin tiene que ser posterior a la de inicio." };

  const staff = await db.staff.findFirst({ where: { businessId: business.id, active: true }, orderBy: { name: "asc" } });
  if (!staff) return { ok: false, message: "No hay profesionales activos." };

  const conflicting = await db.appointment.findMany({
    where: {
      businessId: business.id,
      status: "CONFIRMED",
      startsAt: { lt: end },
      endsAt: { gt: start },
    },
    include: { customer: true, service: { select: { name: true } } },
    orderBy: { startsAt: "asc" },
  });
  const conflicts: ConflictInfo[] = conflicting.map((a) => ({
    id: a.id,
    startsAt: a.startsAt.toISOString(),
    token: a.cancelToken,
    customerName: a.customer.name,
    phone: a.customer.phone,
    serviceName: a.service?.name ?? "Turno especial",
  }));

  // Primero se avisa: el barbero decide si cancela esos turnos.
  if (conflicts.length && !input.cancelConflicts) return { ok: true, conflicts, blocked: false };

  await db.$transaction([
    db.appointment.updateMany({
      where: { id: { in: conflicts.map((c) => c.id) }, status: "CONFIRMED" },
      data: { status: "CANCELLED_BY_BUSINESS", cancelledAt: now },
    }),
    db.timeOff.create({
      data: { staffId: staff.id, startsAt: start, endsAt: end, reason: input.reason?.trim() || null },
    }),
  ]);
  return { ok: true, conflicts, blocked: true };
}

export async function deleteBlock(business: Business, id: string): Promise<ActionResult> {
  const { count } = await db.timeOff.deleteMany({ where: { id, staff: { businessId: business.id } } });
  return count ? { ok: true } : { ok: false, message: "Bloqueo no encontrado." };
}
