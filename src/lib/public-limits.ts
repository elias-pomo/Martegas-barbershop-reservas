import "server-only";
import { isLimited, recordHits } from "./rate-limit";

/**
 * Topes para las acciones públicas, por conexión (IP). Generosos para un uso normal
 * (alguien que reserva para toda la familia) pero frenan a quien quiera llenar la agenda.
 */
export const BOOKING_LIMITS = { perHour: 3, perDay: 6 };
export const WAITLIST_LIMITS = { perHour: 5 };

const bookingKey = (slug: string, ip: string) => `booking-ip:${slug}:${ip}`;
const waitlistKey = (slug: string, ip: string) => `waitlist-ip:${slug}:${ip}`;

export async function bookingLimited(slug: string, ip: string | null, now = new Date()) {
  if (!ip) return false;
  return isLimited(
    [
      { key: bookingKey(slug, ip), limit: BOOKING_LIMITS.perHour, windowMin: 60 },
      { key: bookingKey(slug, ip), limit: BOOKING_LIMITS.perDay, windowMin: 24 * 60 },
    ],
    now,
  );
}

/** Se registra solo cuando la reserva se confirmó. */
export async function recordBooking(slug: string, ip: string | null, now = new Date()) {
  if (ip) await recordHits([bookingKey(slug, ip)], now);
}

export async function waitlistLimited(slug: string, ip: string | null, now = new Date()) {
  if (!ip) return false;
  return isLimited([{ key: waitlistKey(slug, ip), limit: WAITLIST_LIMITS.perHour, windowMin: 60 }], now);
}

export async function recordWaitlist(slug: string, ip: string | null, now = new Date()) {
  if (ip) await recordHits([waitlistKey(slug, ip)], now);
}
