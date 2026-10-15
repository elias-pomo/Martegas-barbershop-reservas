import { localDateOf, localDaysBetween } from "./time";

export const ACTIVE_STATUSES = ["CONFIRMED", "ATTENDED"] as const;
export const NO_SHOW_STATUSES = ["NO_SHOW", "LATE_CANCEL"] as const;

export type AppointmentStatus =
  | "CONFIRMED"
  | "ATTENDED"
  | "NO_SHOW"
  | "LATE_CANCEL"
  | "CANCELLED_BY_CUSTOMER"
  | "CANCELLED_BY_BUSINESS";

export type RuleResult = { ok: true } | { ok: false; reason: string };

/**
 * Límite semanal (R5): 1 turno por semana, o hasta `maxPerWeek` si cada par
 * está separado por al menos `minDaysBetween` días.
 * `existingStarts` = turnos regulares activos del cliente en la misma semana.
 */
export function checkWeeklyLimit(params: {
  existingStarts: Date[];
  candidateStart: Date;
  maxPerWeek: number;
  minDaysBetween: number;
  timeZone: string;
}): RuleResult {
  const { existingStarts, candidateStart, maxPerWeek, minDaysBetween, timeZone } = params;

  if (existingStarts.length >= maxPerWeek) {
    return { ok: false, reason: `Ya tenés ${existingStarts.length} turnos esta semana, que es el máximo.` };
  }

  const candidateDay = localDateOf(candidateStart, timeZone);
  const tooClose = existingStarts.some(
    (s) => localDaysBetween(localDateOf(s, timeZone), candidateDay) < minDaysBetween,
  );
  if (tooClose) {
    return {
      ok: false,
      reason: `Para tener dos turnos en la semana tiene que haber al menos ${minDaysBetween} días entre ellos.`,
    };
  }

  return { ok: true };
}

/** R6: se puede cancelar online hasta `cancelMinHours` antes del inicio. */
export function canCancelOnline(start: Date, now: Date, cancelMinHours: number): boolean {
  return start.getTime() - now.getTime() >= cancelMinHours * 3_600_000;
}

/** R7: con demasiadas faltas solo se puede pedir turno por WhatsApp. */
export function isOnlineBookingBlocked(noShowCount: number, threshold: number): boolean {
  return noShowCount >= threshold;
}

/** R10: un turno confirmado que ya terminó cuenta como asistido. */
export function effectiveStatus(
  status: AppointmentStatus,
  end: Date,
  now: Date,
): AppointmentStatus {
  return status === "CONFIRMED" && end.getTime() <= now.getTime() ? "ATTENDED" : status;
}
