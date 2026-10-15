import "server-only";
import type { Admin } from "./auth";
import { getBusinessBySlug } from "./business";
import { db } from "./db";
import { bookingWindow } from "./domain/availability";
import { normalizePhone } from "./domain/phone";

type Business = Admin["business"];
export type WaitlistResult = { ok: true } | { ok: false; message: string };

/** El cliente se anota para un día completo. Si ya estaba anotado, se actualiza (no se duplica). */
export async function joinWaitlist(
  slug: string,
  input: { day: string; serviceId?: string; name: string; phone: string },
  now = new Date(),
): Promise<WaitlistResult> {
  const business = await getBusinessBySlug(slug);
  if (!business) return { ok: false, message: "Negocio no encontrado." };

  if (!bookingWindow(now, business.timezone, business.settings.weekStartsOn).includes(input.day)) {
    return { ok: false, message: "Solo te podés anotar para los días de esta semana." };
  }
  const phone = normalizePhone(input.phone, business.settings.defaultAreaCode);
  if (!phone) return { ok: false, message: "Revisá el teléfono: tiene que tener característica, por ejemplo 381 1234567." };
  const serviceId = business.services.some((s) => s.id === input.serviceId) ? input.serviceId : null;
  const name = input.name.trim().replace(/\s+/g, " ");

  await db.waitlistEntry.upsert({
    where: { businessId_day_phone: { businessId: business.id, day: input.day, phone } },
    create: { businessId: business.id, day: input.day, phone, name, serviceId },
    update: { name, serviceId, status: "WAITING" },
  });
  return { ok: true };
}

/** Lista de espera de un día para el panel (sin las cerradas). */
export async function getWaitlistForDay(business: Business, day: string) {
  const [entries, services] = await Promise.all([
    db.waitlistEntry.findMany({
      where: { businessId: business.id, day, status: { not: "CLOSED" } },
      orderBy: { createdAt: "asc" },
    }),
    db.service.findMany({ where: { businessId: business.id }, select: { id: true, name: true } }),
  ]);
  const serviceName = new Map(services.map((s) => [s.id, s.name]));
  return entries.map((e) => ({
    id: e.id,
    day: e.day,
    name: e.name,
    phone: e.phone,
    status: e.status as "WAITING" | "CONTACTED",
    serviceName: e.serviceId ? (serviceName.get(e.serviceId) ?? null) : null,
  }));
}

export async function setWaitlistStatus(
  business: Business,
  id: string,
  status: "CONTACTED" | "CLOSED",
): Promise<WaitlistResult> {
  const { count } = await db.waitlistEntry.updateMany({ where: { id, businessId: business.id }, data: { status } });
  return count ? { ok: true } : { ok: false, message: "No encontrado." };
}

/** Cuántos esperan lugar ese día (para el aviso al barbero cuando alguien cancela). */
export async function countWaiting(businessId: string, day: string) {
  return db.waitlistEntry.count({ where: { businessId, day, status: { not: "CLOSED" } } });
}
