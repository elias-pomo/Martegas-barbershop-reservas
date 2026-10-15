import "server-only";
import type { Admin } from "./auth";
import { db } from "./db";
import { NO_SHOW_STATUSES, type AppointmentStatus } from "./domain/rules";

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

export async function renameCustomer(business: Business, id: string, name: string) {
  const { count } = await db.customer.updateMany({
    where: { id, businessId: business.id },
    data: { name: name.trim().replace(/\s+/g, " ") },
  });
  return count > 0;
}
