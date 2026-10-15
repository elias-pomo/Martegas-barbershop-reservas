import { candidateStarts, overlaps, type Interval, type WorkingBlock } from "./availability";
import type { LocalDate } from "./time";

/** Línea de tiempo de un día en el panel: turnos, bloqueos y huecos libres, ordenados por hora. */
export type TimelineEntry<A extends Interval, B extends Interval> =
  | { kind: "appointment"; start: Date; item: A }
  | { kind: "block"; start: Date; item: B }
  | { kind: "free"; start: Date };

export function buildDayTimeline<A extends Interval & { active: boolean }, B extends Interval>(params: {
  day: LocalDate;
  timeZone: string;
  workingHours: WorkingBlock[];
  slotIntervalMin: number;
  /** Duración del servicio más corto: un hueco es "libre" si entra al menos eso. */
  minDurationMin: number;
  appointments: A[];
  blocks: B[];
  now: Date;
}): TimelineEntry<A, B>[] {
  const busy: Interval[] = [...params.appointments.filter((a) => a.active), ...params.blocks];

  const free = candidateStarts(params.day, params.workingHours, params.slotIntervalMin, params.timeZone)
    .filter((start) => start.getTime() > params.now.getTime())
    .filter((start) => {
      const slot = { start, end: new Date(start.getTime() + params.minDurationMin * 60_000) };
      return !busy.some((b) => overlaps(slot, b));
    })
    .map((start) => ({ kind: "free" as const, start }));

  const entries: TimelineEntry<A, B>[] = [
    ...params.appointments.map((item) => ({ kind: "appointment" as const, start: item.start, item })),
    ...params.blocks.map((item) => ({ kind: "block" as const, start: item.start, item })),
    ...free,
  ];
  // A igual hora: primero los turnos, después bloqueos, después libres.
  const order = { appointment: 0, block: 1, free: 2 };
  return entries.sort((a, b) => a.start.getTime() - b.start.getTime() || order[a.kind] - order[b.kind]);
}
