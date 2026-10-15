import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { db } from "./db";
import { getBusinessBySlug, type PublicBusiness } from "./business";
import {
  bookingWindow,
  currentWeek,
  getAvailability,
  isSlotAvailable,
  type AvailabilityInput,
  type DayAvailability,
  type Interval,
  weekOverview,
} from "./domain/availability";
import { normalizePhone } from "./domain/phone";
import {
  ACTIVE_STATUSES,
  NO_SHOW_STATUSES,
  checkWeeklyLimit,
  isOnlineBookingBlocked,
} from "./domain/rules";
import { addLocalDays, atLocalTime, localDateOf, weekRange } from "./domain/time";

/**
 * Profesionales activos (que hacen el servicio, si se indica), con su horario y lo que
 * tienen ocupado entre los días locales `days[0]` y `days.at(-1)` inclusive.
 */
async function loadStaffSchedules(business: PublicBusiness, days: string[], serviceId?: string) {
  const from = atLocalTime(days[0], "00:00", business.timezone);
  const to = atLocalTime(addLocalDays(days.at(-1)!, 1), "00:00", business.timezone);

  const staff = await db.staff.findMany({
    where: {
      businessId: business.id,
      active: true,
      ...(serviceId && { services: { some: { serviceId } } }),
    },
    include: {
      workingHours: true,
      appointments: {
        where: { status: { in: [...ACTIVE_STATUSES] }, startsAt: { lt: to }, endsAt: { gt: from } },
        select: { startsAt: true, endsAt: true },
      },
      timeOff: {
        where: { startsAt: { lt: to }, endsAt: { gt: from } },
        select: { startsAt: true, endsAt: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return staff.map((s) => ({
    id: s.id,
    workingHours: s.workingHours,
    busy: [...s.appointments, ...s.timeOff].map<Interval>((b) => ({ start: b.startsAt, end: b.endsAt })),
  }));
}

function availabilityInput(
  business: PublicBusiness,
  durationMin: number,
  now: Date,
  staff: { workingHours: AvailabilityInput["workingHours"]; busy: Interval[] },
): AvailabilityInput {
  const s = business.settings;
  return {
    now,
    timeZone: business.timezone,
    weekStartsOn: s.weekStartsOn,
    slotIntervalMin: s.slotIntervalMin,
    minLeadMin: s.minLeadMin,
    durationMin,
    workingHours: staff.workingHours,
    busy: staff.busy,
  };
}

/** Disponibilidad combinada de todos los profesionales que hacen el servicio. */
export async function getServiceAvailability(slug: string, serviceId: string, now = new Date()) {
  const business = await getBusinessBySlug(slug);
  const service = business?.services.find((s) => s.id === serviceId);
  if (!business || !service) return null;

  const window = bookingWindow(now, business.timezone, business.settings.weekStartsOn);
  const staff = await loadStaffSchedules(business, window, serviceId);
  const perStaff = staff.map((s) => getAvailability(availabilityInput(business, service.durationMin, now, s)));

  const days: DayAvailability[] = window.map(
    (date, i) => {
      const starts = new Map<number, Interval>();
      for (const staffDays of perStaff) {
        for (const slot of staffDays[i].slots) starts.set(slot.start.getTime(), slot);
      }
      return {
        date,
        open: perStaff.some((d) => d[i].open),
        slots: [...starts.values()].sort((a, b) => a.start.getTime() - b.start.getTime()),
      };
    },
  );

  return { business, service, days };
}

/** Semana en curso para la página de inicio: libre / ocupado / pasado, sin datos de clientes. */
export async function getWeekOverview(slug: string, now = new Date()) {
  const business = await getBusinessBySlug(slug);
  if (!business || business.services.length === 0) return null;

  const s = business.settings;
  const week = currentWeek(now, business.timezone, s.weekStartsOn);
  const staff = await loadStaffSchedules(business, week);

  return {
    timeZone: business.timezone,
    days: weekOverview({
      now,
      timeZone: business.timezone,
      weekStartsOn: s.weekStartsOn,
      slotIntervalMin: s.slotIntervalMin,
      minLeadMin: s.minLeadMin,
      durationMin: Math.min(...business.services.map((sv) => sv.durationMin)),
      staff,
    }),
  };
}

export type BookingError = {
  code: "INVALID_INPUT" | "INVALID_PHONE" | "SLOT_TAKEN" | "WEEKLY_LIMIT" | "BLOCKED" | "NOT_FOUND";
  message: string;
};

export type BookingResult =
  | {
      ok: true;
      appointment: { token: string; code: string; startsAt: string; endsAt: string; serviceName: string; price: number };
    }
  | { ok: false; error: BookingError };

export function hashCancelCode(token: string, code: string): string {
  return createHash("sha256").update(`${token}:${code}`).digest("hex");
}

const isOverlapViolation = (e: unknown) =>
  e instanceof Error && /appointment_no_overlap|23P01|exclusion constraint|conflicting key/i.test(
    `${e.message} ${JSON.stringify(e)}`,
  );

export async function createBooking(input: {
  slug: string;
  serviceId: string;
  startsAt: Date;
  name: string;
  phone: string;
  now?: Date;
}): Promise<BookingResult> {
  const now = input.now ?? new Date();
  const business = await getBusinessBySlug(input.slug);
  const service = business?.services.find((s) => s.id === input.serviceId);
  if (!business || !service) {
    return { ok: false, error: { code: "NOT_FOUND", message: "El servicio ya no está disponible." } };
  }
  const settings = business.settings;

  const phone = normalizePhone(input.phone, settings.defaultAreaCode);
  if (!phone) {
    return {
      ok: false,
      error: { code: "INVALID_PHONE", message: "Revisá el teléfono: tiene que tener característica, por ejemplo 381 1234567." },
    };
  }

  const customer = await db.customer.findUnique({
    where: { businessId_phone: { businessId: business.id, phone } },
  });

  if (customer) {
    const noShows = await db.appointment.count({
      where: { customerId: customer.id, status: { in: [...NO_SHOW_STATUSES] } },
    });
    if (isOnlineBookingBlocked(noShows, settings.noShowBlockThreshold)) {
      return {
        ok: false,
        error: { code: "BLOCKED", message: "Para este turno escribile directamente por WhatsApp." },
      };
    }

    const week = weekRange(localDateOf(input.startsAt, business.timezone), settings.weekStartsOn, business.timezone);
    const sameWeek = await db.appointment.findMany({
      where: {
        customerId: customer.id,
        type: "REGULAR",
        status: { in: [...ACTIVE_STATUSES] },
        startsAt: { gte: week.start, lt: week.end },
      },
      select: { startsAt: true },
    });
    const limit = checkWeeklyLimit({
      existingStarts: sameWeek.map((a) => a.startsAt),
      candidateStart: input.startsAt,
      maxPerWeek: settings.maxPerWeek,
      minDaysBetween: settings.minDaysBetween,
      timeZone: business.timezone,
    });
    if (!limit.ok) return { ok: false, error: { code: "WEEKLY_LIMIT", message: limit.reason } };
  }

  // Primer profesional libre en ese horario.
  const staff = await loadStaffSchedules(
    business,
    bookingWindow(now, business.timezone, settings.weekStartsOn),
    service.id,
  );
  const chosen = staff.find((s) =>
    isSlotAvailable(availabilityInput(business, service.durationMin, now, s), input.startsAt),
  );
  if (!chosen) {
    return { ok: false, error: { code: "SLOT_TAKEN", message: "Ese horario se acaba de ocupar. Elegí otro." } };
  }

  const token = randomBytes(24).toString("base64url");
  const code = randomInt(0, 10_000).toString().padStart(4, "0");
  const endsAt = new Date(input.startsAt.getTime() + service.durationMin * 60_000);
  const name = input.name.trim().replace(/\s+/g, " ");

  try {
    await db.$transaction(async (tx) => {
      const c = await tx.customer.upsert({
        where: { businessId_phone: { businessId: business.id, phone } },
        create: { businessId: business.id, phone, name },
        update: { name },
      });
      await tx.appointment.create({
        data: {
          businessId: business.id,
          staffId: chosen.id,
          serviceId: service.id,
          customerId: c.id,
          startsAt: input.startsAt,
          endsAt,
          price: service.price,
          cancelToken: token,
          cancelCodeHash: hashCancelCode(token, code),
        },
      });
    });
  } catch (e) {
    // Dos personas reservaron el mismo horario al mismo tiempo: la base rechazó la segunda.
    if (isOverlapViolation(e)) {
      return { ok: false, error: { code: "SLOT_TAKEN", message: "Ese horario se acaba de ocupar. Elegí otro." } };
    }
    throw e;
  }

  return {
    ok: true,
    appointment: {
      token,
      code,
      startsAt: input.startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      serviceName: service.name,
      price: service.price,
    },
  };
}
