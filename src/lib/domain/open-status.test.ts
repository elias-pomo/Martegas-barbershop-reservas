import { describe, expect, it } from "vitest";
import { openStatus, opensLabel } from "./open-status";

const TZ = "America/Argentina/Tucuman";
const at = (local: string) => new Date(`${local}:00-03:00`);
// Lunes a sábado, primer turno 15:00, último 22:00 (cierra 23:00). Semana: dom 11/10/2026 … sáb 17/10.
const hours = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, firstStart: "15:00", lastStart: "22:00" }));
const status = (now: string, timeOff: { start: Date; end: Date }[] = []) =>
  openStatus({ now: at(now), timeZone: TZ, workingHours: hours, slotIntervalMin: 60, timeOff });

describe("openStatus", () => {
  it("abierto en horario, hasta que termina el último turno", () => {
    expect(status("2026-10-15T15:00")).toEqual({ open: true, lastStart: "22:00" });
    expect(status("2026-10-15T22:59")).toMatchObject({ open: true });
    expect(status("2026-10-15T23:00")).toMatchObject({ open: false });
  });

  it("antes de abrir indica que abre hoy", () => {
    const s = status("2026-10-15T10:00");
    expect(s).toEqual({ open: false, opensAt: at("2026-10-15T15:00") });
    if (!s.open) expect(opensLabel(s.opensAt!, at("2026-10-15T10:00"), TZ)).toBe("abre hoy a las 15:00");
  });

  it("de noche indica que abre mañana; el sábado a la noche, el lunes", () => {
    const thu = status("2026-10-15T23:30");
    if (!thu.open) expect(opensLabel(thu.opensAt!, at("2026-10-15T23:30"), TZ)).toBe("abre mañana a las 15:00");
    const sat = status("2026-10-17T23:30");
    if (!sat.open) expect(opensLabel(sat.opensAt!, at("2026-10-17T23:30"), TZ)).toBe("abre el lunes a las 15:00");
  });

  it("un bloqueo del día (vacaciones, trámite) lo muestra cerrado", () => {
    const off = [{ start: at("2026-10-15T00:00"), end: at("2026-10-16T00:00") }];
    const s = status("2026-10-15T16:00", off);
    expect(s).toEqual({ open: false, opensAt: at("2026-10-16T15:00") });
  });

  it("sin horario cargado no inventa una apertura", () => {
    expect(openStatus({ now: at("2026-10-15T16:00"), timeZone: TZ, workingHours: [], slotIntervalMin: 60, timeOff: [] })).toEqual({
      open: false,
      opensAt: null,
    });
  });
});
