import "server-only";
import { db } from "./db";
import { getBusinessBySlug } from "./business";
import { hashCancelCode } from "./booking";
import { normalizePhone } from "./domain/phone";
import { canCancelOnline, effectiveStatus } from "./domain/rules";

const MAX_LOOKUP_ATTEMPTS = 5;
const LOOKUP_WINDOW_MS = 15 * 60_000;

export async function getAppointmentByToken(slug: string, token: string, now = new Date()) {
  const business = await getBusinessBySlug(slug);
  if (!business) return null;

  const appointment = await db.appointment.findFirst({
    where: { cancelToken: token, businessId: business.id },
    include: { service: true, customer: { select: { name: true } } },
  });
  if (!appointment) return null;

  const status = effectiveStatus(appointment.status, appointment.endsAt, now);
  return {
    business,
    appointment: {
      token: appointment.cancelToken,
      status,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      serviceName: appointment.service?.name ?? "Turno especial",
      price: appointment.price,
      customerName: appointment.customer.name,
      isUpcoming: status === "CONFIRMED",
      canCancel: status === "CONFIRMED" && canCancelOnline(appointment.startsAt, now, business.settings.cancelMinHours),
    },
  };
}

export type CancelResult = { ok: true } | { ok: false; message: string };

export async function cancelByToken(slug: string, token: string, now = new Date()): Promise<CancelResult> {
  const found = await getAppointmentByToken(slug, token, now);
  if (!found) return { ok: false, message: "No encontramos ese turno." };
  if (!found.appointment.isUpcoming) return { ok: false, message: "Este turno ya no está activo." };
  if (!found.appointment.canCancel) {
    return {
      ok: false,
      message: `Faltan menos de ${found.business.settings.cancelMinHours} horas: avisale por WhatsApp.`,
    };
  }

  // Condición en el where: si cambió el estado entre la lectura y la escritura, no se pisa.
  const { count } = await db.appointment.updateMany({
    where: { cancelToken: token, status: "CONFIRMED" },
    data: { status: "CANCELLED_BY_CUSTOMER", cancelledAt: now },
  });
  return count ? { ok: true } : { ok: false, message: "Este turno ya no está activo." };
}

export type LookupResult = { ok: true; token: string } | { ok: false; message: string };

/** Respaldo para cancelar desde otro celular: teléfono + código de 4 dígitos, con límite de intentos. */
export async function findByPhoneAndCode(
  slug: string,
  rawPhone: string,
  code: string,
  now = new Date(),
): Promise<LookupResult> {
  const business = await getBusinessBySlug(slug);
  if (!business) return { ok: false, message: "Negocio no encontrado." };

  const phone = normalizePhone(rawPhone, business.settings.defaultAreaCode);
  if (!phone) return { ok: false, message: "Revisá el teléfono." };

  const recentFailures = await db.cancelAttempt.count({
    where: { businessId: business.id, phone, createdAt: { gt: new Date(now.getTime() - LOOKUP_WINDOW_MS) } },
  });
  if (recentFailures >= MAX_LOOKUP_ATTEMPTS) {
    return { ok: false, message: "Demasiados intentos. Probá de nuevo en 15 minutos." };
  }

  const upcoming = await db.appointment.findMany({
    where: {
      businessId: business.id,
      customer: { phone },
      status: "CONFIRMED",
      endsAt: { gt: now },
    },
    select: { cancelToken: true, cancelCodeHash: true },
    orderBy: { startsAt: "asc" },
  });
  const match = upcoming.find((a) => a.cancelCodeHash === hashCancelCode(a.cancelToken, code));

  if (!match) {
    await db.cancelAttempt.create({ data: { businessId: business.id, phone, createdAt: now } });
    return { ok: false, message: "No encontramos un turno próximo con ese teléfono y código." };
  }
  return { ok: true, token: match.cancelToken };
}

/** Estado actual de los turnos guardados en el dispositivo (pueden haber sido cancelados por el negocio). */
export async function getStatusesByTokens(slug: string, tokens: string[], now = new Date()) {
  const business = await getBusinessBySlug(slug);
  if (!business || tokens.length === 0) return {};
  const rows = await db.appointment.findMany({
    where: { businessId: business.id, cancelToken: { in: tokens.slice(0, 20) } },
    select: { cancelToken: true, status: true, endsAt: true },
  });
  return Object.fromEntries(rows.map((r) => [r.cancelToken, effectiveStatus(r.status, r.endsAt, now)]));
}
