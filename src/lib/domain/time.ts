import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, format } from "date-fns";

/** Fecha local del negocio en formato `YYYY-MM-DD`. */
export type LocalDate = string;

export function toZoned(date: Date, timeZone: string): TZDate {
  return new TZDate(date.getTime(), timeZone);
}

export function localDateOf(date: Date, timeZone: string): LocalDate {
  return format(toZoned(date, timeZone), "yyyy-MM-dd");
}

/** Instante correspondiente a `HH:mm` de una fecha local en la zona del negocio. */
export function atLocalTime(day: LocalDate, hhmm: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, timeZone).getTime());
}

/** Día de la semana (0 = domingo) de una fecha local. */
export function weekdayOf(day: LocalDate): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addLocalDays(day: LocalDate, amount: number): LocalDate {
  const [y, m, d] = day.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + amount));
  return next.toISOString().slice(0, 10);
}

export function localDaysBetween(a: LocalDate, b: LocalDate): number {
  return Math.abs(
    differenceInCalendarDays(new Date(`${a}T00:00:00Z`), new Date(`${b}T00:00:00Z`)),
  );
}

/** Primer día (local) de la semana que contiene `day`. */
export function weekStartOf(day: LocalDate, weekStartsOn: number): LocalDate {
  const offset = (weekdayOf(day) - weekStartsOn + 7) % 7;
  return addLocalDays(day, -offset);
}

/** Inicio y fin (exclusivo) en UTC de la semana local que contiene `day`. */
export function weekRange(day: LocalDate, weekStartsOn: number, timeZone: string) {
  const start = weekStartOf(day, weekStartsOn);
  return {
    start: atLocalTime(start, "00:00", timeZone),
    end: atLocalTime(addLocalDays(start, 7), "00:00", timeZone),
  };
}
