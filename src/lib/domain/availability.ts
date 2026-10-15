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

export type SlotState = "free" | "busy" | "past";

export interface WeekOverviewDay {
  date: LocalDate;
  open: boolean;
  slots: { start: Date; state: SlotState }[];
}

/** Días de la semana en curso (completa, incluso los ya pasados). */
export function currentWeek(now: Date, timeZone: string, weekStartsOn: number): LocalDate[] {
  const start = weekStartOf(localDateOf(now, timeZone), weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addLocalDays(start, i));
}

/**
 * Resumen público de la semana: cada inicio de turno como libre, ocupado o pasado.
 * No expone quién reservó. Un horario está libre si algún profesional puede tomar
 * un servicio de `durationMin` (el más corto) en ese momento.
 */
export function weekOverview(params: {
  now: Date;
  timeZone: string;
  weekStartsOn: number;
  slotIntervalMin: number;
  minLeadMin: number;
  durationMin: number;
  staff: { workingHours: WorkingBlock[]; busy: Interval[] }[];
}): WeekOverviewDay[] {
  const earliest = params.now.getTime() + params.minLeadMin * MINUTE;

  return currentWeek(params.now, params.timeZone, params.weekStartsOn).map((date) => {
    const perStaff = params.staff.map((s) => ({
      busy: s.busy,
      starts: candidateStarts(date, s.workingHours, params.slotIntervalMin, params.timeZone),
    }));
    const allStarts = [...new Set(perStaff.flatMap((s) => s.starts.map((d) => d.getTime())))].sort((a, b) => a - b);

    const slots = allStarts.map((t) => {
      const start = new Date(t);
      if (t < earliest) return { start, state: "past" as const };
      const slot = { start, end: new Date(t + params.durationMin * MINUTE) };
      const free = perStaff.some(
        (s) => s.starts.some((d) => d.getTime() === t) && !s.busy.some((b) => overlaps(slot, b)),
      );
      return { start, state: free ? ("free" as const) : ("busy" as const) };
    });

    return { date, open: allStarts.length > 0, slots };
  });
}
