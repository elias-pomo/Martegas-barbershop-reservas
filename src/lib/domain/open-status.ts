import type { Interval, WorkingBlock } from "./availability";
import { addLocalDays, atLocalTime, localDateOf, weekdayOf } from "./time";

export type OpenStatus =
  | { open: true; lastStart: string }
  | { open: false; opensAt: Date | null };

/**
 * Estado del local para el cartel del inicio. Está abierto desde el primer turno hasta
 * que termina el último (último inicio + intervalo), salvo que haya un bloqueo en ese momento.
 * Si está cerrado, busca la próxima apertura en los siguientes 7 días.
 */
export function openStatus(params: {
  now: Date;
  timeZone: string;
  workingHours: WorkingBlock[];
  slotIntervalMin: number;
  timeOff: Interval[];
}): OpenStatus {
  const { now, timeZone, workingHours, slotIntervalMin, timeOff } = params;
  const blocked = (t: Date) => timeOff.some((b) => b.start <= t && t < b.end);
  const today = localDateOf(now, timeZone);

  for (const block of workingHours.filter((b) => b.weekday === weekdayOf(today))) {
    const start = atLocalTime(today, block.firstStart, timeZone);
    const end = new Date(atLocalTime(today, block.lastStart, timeZone).getTime() + slotIntervalMin * 60_000);
    if (start <= now && now < end && !blocked(now)) return { open: true, lastStart: block.lastStart };
  }

  for (let i = 0; i <= 7; i++) {
    const day = addLocalDays(today, i);
    const starts = workingHours
      .filter((b) => b.weekday === weekdayOf(day))
      .map((b) => atLocalTime(day, b.firstStart, timeZone))
      .filter((s) => s > now && !blocked(s))
      .sort((a, b) => a.getTime() - b.getTime());
    if (starts.length) return { open: false, opensAt: starts[0] };
  }
  return { open: false, opensAt: null };
}

/** "hoy", "mañana" o "el lunes" para la próxima apertura. */
export function opensLabel(opensAt: Date, now: Date, timeZone: string): string {
  const day = localDateOf(opensAt, timeZone);
  const today = localDateOf(now, timeZone);
  const time = opensAt.toLocaleTimeString("es-AR", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  if (day === today) return `abre hoy a las ${time}`;
  if (day === addLocalDays(today, 1)) return `abre mañana a las ${time}`;
  const weekday = opensAt.toLocaleDateString("es-AR", { timeZone, weekday: "long" });
  return `abre el ${weekday} a las ${time}`;
}
