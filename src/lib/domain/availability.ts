import {
  addLocalDays,
  atLocalTime,
  localDateOf,
  weekdayOf,
  weekStartOf,
  type LocalDate,
} from "./time";

export interface Interval {
  start: Date;
  end: Date;
}

export interface WorkingBlock {
  /** 0 = domingo … 6 = sábado */
  weekday: number;
  /** Primer inicio de turno, `HH:mm`. */
  firstStart: string;
  /** Último inicio de turno posible, `HH:mm`. */
  lastStart: string;
}

export interface DayAvailability {
  date: LocalDate;
  /** El profesional trabaja ese día (aunque no queden horarios). */
  open: boolean;
  slots: Interval[];
}

export interface AvailabilityInput {
  now: Date;
  timeZone: string;
  weekStartsOn: number;
  slotIntervalMin: number;
  minLeadMin: number;
  durationMin: number;
  workingHours: WorkingBlock[];
  /** Turnos activos y bloqueos del profesional. */
  busy: Interval[];
}

const MINUTE = 60_000;

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Días habilitados para reservar: desde hoy hasta el último día de la semana en curso.
 * Como la semana empieza el domingo, el domingo a las 00:00 se habilita la semana siguiente.
 */
export function bookingWindow(now: Date, timeZone: string, weekStartsOn: number): LocalDate[] {
  const today = localDateOf(now, timeZone);
  const lastDay = addLocalDays(weekStartOf(today, weekStartsOn), 6);
  const days: LocalDate[] = [];
  for (let d = today; d <= lastDay; d = addLocalDays(d, 1)) days.push(d);
  return days;
}

export function isInBookingWindow(
  start: Date,
  now: Date,
  timeZone: string,
  weekStartsOn: number,
): boolean {
  return bookingWindow(now, timeZone, weekStartsOn).includes(localDateOf(start, timeZone));
}

/** Inicios de turno de un día según el horario laboral, sin filtrar ocupados. */
export function candidateStarts(
  day: LocalDate,
  workingHours: WorkingBlock[],
  slotIntervalMin: number,
  timeZone: string,
): Date[] {
  const weekday = weekdayOf(day);
  const starts: Date[] = [];
  for (const block of workingHours.filter((b) => b.weekday === weekday)) {
    const first = atLocalTime(day, block.firstStart, timeZone).getTime();
    const last = atLocalTime(day, block.lastStart, timeZone).getTime();
    for (let t = first; t <= last; t += slotIntervalMin * MINUTE) starts.push(new Date(t));
  }
  return starts.sort((a, b) => a.getTime() - b.getTime());
}

export function getAvailability(input: AvailabilityInput): DayAvailability[] {
  const earliest = input.now.getTime() + input.minLeadMin * MINUTE;

  return bookingWindow(input.now, input.timeZone, input.weekStartsOn).map((date) => {
    const starts = candidateStarts(date, input.workingHours, input.slotIntervalMin, input.timeZone);
    const slots = starts
      .filter((start) => start.getTime() >= earliest)
      .map((start) => ({ start, end: new Date(start.getTime() + input.durationMin * MINUTE) }))
      .filter((slot) => !input.busy.some((b) => overlaps(slot, b)));
    return { date, open: starts.length > 0, slots };
  });
}

/** Verifica que un inicio puntual sea reservable (misma lógica que la grilla, para validar en el servidor). */
export function isSlotAvailable(input: AvailabilityInput, start: Date): boolean {
  const day = localDateOf(start, input.timeZone);
  return getAvailability(input)
    .find((d) => d.date === day)
    ?.slots.some((s) => s.start.getTime() === start.getTime()) ?? false;
}
