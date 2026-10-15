import { describe, expect, it } from "vitest";
import { buildDayTimeline } from "./agenda";

const TZ = "America/Argentina/Tucuman";
const at = (local: string) => new Date(`${local}:00-03:00`);
const hhmm = (d: Date) =>
  d.toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

const base = {
  day: "2026-10-15",
  timeZone: TZ,
  workingHours: [{ weekday: 4, firstStart: "15:00", lastStart: "22:00" }],
  slotIntervalMin: 60,
  minDurationMin: 60,
  now: at("2026-10-15T09:00"),
};

describe("buildDayTimeline", () => {
  it("intercala turnos, bloqueos y huecos libres en orden", () => {
    const timeline = buildDayTimeline({
      ...base,
      appointments: [{ id: "a", start: at("2026-10-15T18:00"), end: at("2026-10-15T19:30"), active: true }],
      blocks: [{ id: "b", start: at("2026-10-15T21:00"), end: at("2026-10-15T23:00") }],
    });
    expect(timeline.map((e) => `${hhmm(e.start)} ${e.kind}`)).toEqual([
      "15:00 free",
      "16:00 free",
      "17:00 free",
      "18:00 appointment",
      "20:00 free",
      "21:00 block",
    ]);
  });

  it("un turno cancelado se muestra pero no ocupa el horario", () => {
    const timeline = buildDayTimeline({
      ...base,
      appointments: [{ id: "a", start: at("2026-10-15T15:00"), end: at("2026-10-15T16:00"), active: false }],
      blocks: [],
    });
    expect(timeline.slice(0, 2).map((e) => e.kind)).toEqual(["appointment", "free"]);
    expect(hhmm(timeline[1].start)).toBe("15:00");
  });

  it("no ofrece huecos que ya pasaron", () => {
    const timeline = buildDayTimeline({ ...base, now: at("2026-10-15T20:30"), appointments: [], blocks: [] });
    expect(timeline.map((e) => hhmm(e.start))).toEqual(["21:00", "22:00"]);
  });

  it("muestra turnos fuera del horario laboral (especiales)", () => {
    const timeline = buildDayTimeline({
      ...base,
      day: "2026-10-18", // domingo, cerrado
      appointments: [{ id: "a", start: at("2026-10-18T11:00"), end: at("2026-10-18T12:00"), active: true }],
      blocks: [],
    });
    expect(timeline).toHaveLength(1);
    expect(timeline[0].kind).toBe("appointment");
  });
});
