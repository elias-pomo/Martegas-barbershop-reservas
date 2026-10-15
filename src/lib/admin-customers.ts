import "server-only";
import type { Admin } from "./auth";
import { db } from "./db";
import { NO_SHOW_STATUSES, type AppointmentStatus } from "./domain/rules";
import { localDateOf, monthRange, monthStartOf } from "./domain/time";

type Business = Admin["business"];

export interface CustomerStats {
  attended: number;
  noShows: number;
  cancelled: number;
  upcoming: number;
}

function emptyStats(): CustomerStats {
  return { attended: 0, noShows: 0, cancelled: 0, upcoming: 0 };
}

function addToStats(stats: CustomerStats, status: AppointmentStatus, count: number) {
  if (status === "ATTENDED") stats.attended += count;
  else if ((NO_SHOW_STATUSES as readonly string[]).includes(status)) stats.noShows += count;
  else if (status === "CANCELLED_BY_CUSTOMER") stats.cancelled += count;
  else if (status === "CONFIRMED") stats.upcoming += count;
}

/** Todos los clientes del negocio con sus contadores (se filtra y ordena en el navegador). */
export async function listCustomers(business: Business) {
  const [customers, byStatus, lastVisit] = await Promise.all([
    db.customer.findMany({
      where: { businessId: business.id },
      select: { id: true, name: true, phone: true, createdAt: true },
      take: 2000,
    }),
    db.appointment.groupBy({
      by: ["customerId", "status"],
      where: { businessId: business.id },
      _count: true,
    }),
    db.appointment.groupBy({
      by: ["customerId"],
      where: { businessId: business.id, status: { in: ["ATTENDED", "CONFIRMED"] } },
      _max: { startsAt: true },
    }),
  ]);

  const stats = new Map<string, CustomerStats>();
  for (const row of byStatus) {
    const s = stats.get(row.customerId) ?? emptyStats();
    addToStats(s, row.status as AppointmentStatus, row._count);
    stats.set(row.customerId, s);
  }
  const last = new Map(lastVisit.map((r) => [r.customerId, r._max.startsAt]));

  return customers.map((c) => ({
    ...c,
    stats: stats.get(c.id) ?? emptyStats(),
    lastAppointment: last.get(c.id) ?? null,
  }));
}

export async function getCustomerDetail(business: Business, id: string) {
  const customer = await db.customer.findFirst({
    where: { id, businessId: business.id },
    include: {
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 100,
        include: { service: { select: { name: true } } },
      },
    },
  });
  if (!customer) return null;

  const stats = emptyStats();
  for (const a of customer.appointments) addToStats(stats, a.status as AppointmentStatus, 1);

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    createdAt: customer.createdAt,
    stats,
    blocked: stats.noShows >= business.settings.noShowBlockThreshold,
    appointments: customer.appointments.map((a) => ({
      id: a.id,
      startsAt: a.startsAt,
      status: a.status as AppointmentStatus,
      serviceName: a.service?.name ?? "Turno especial",
      price: a.price,
    })),
  };
}

export interface MonthSummary {
  /** Primer día del mes, `YYYY-MM-01`. */
  month: string;
  /** Cortes realizados (cuenta personas: un turno a domicilio de 3 son 3 cortes). */
  cuts: number;
  /** Suma de precios de los turnos asistidos. Es una estimación: no se registra el cobro. */
  revenue: number;
}

/**
 * Resumen del mes en curso y el anterior, más lo que queda confirmado en este mes.
 * Llamar después de `persistAttended` para que los turnos terminados cuenten.
 */
export async function getMonthlySummary(business: Business, now = new Date()) {
  const today = localDateOf(now, business.timezone);

  const summarize = async (offset: number): Promise<MonthSummary> => {
    const { start, end } = monthRange(today, business.timezone, offset);
    const agg = await db.appointment.aggregate({
      where: { businessId: business.id, status: "ATTENDED", startsAt: { gte: start, lt: end } },
      _sum: { people: true, price: true },
    });
    return { month: monthStartOf(today, offset), cuts: agg._sum.people ?? 0, revenue: agg._sum.price ?? 0 };
  };

  const { end } = monthRange(today, business.timezone);
  const [current, previous, pending] = await Promise.all([
    summarize(0),
    summarize(-1),
    db.appointment.aggregate({
      where: { businessId: business.id, status: "CONFIRMED", startsAt: { gte: now, lt: end } },
      _sum: { people: true, price: true },
    }),
  ]);

  return {
    current,
    previous,
    pending: { cuts: pending._sum.people ?? 0, revenue: pending._sum.price ?? 0 },
  };
}

export type MonthlySummary = Awaited<ReturnType<typeof getMonthlySummary>>;

export async function renameCustomer(business: Business, id: string, name: string) {
  const { count } = await db.customer.updateMany({
    where: { id, businessId: business.id },
    data: { name: name.trim().replace(/\s+/g, " ") },
  });
  return count > 0;
}
