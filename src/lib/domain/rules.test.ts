import { describe, expect, it } from "vitest";
import { canCancelOnline, checkWeeklyLimit, effectiveStatus, isOnlineBookingBlocked } from "./rules";

const TZ = "America/Argentina/Tucuman";
const at = (local: string) => new Date(`${local}:00-03:00`);
const limit = (existing: string[], candidate: string) =>
  checkWeeklyLimit({
    existingStarts: existing.map(at),
    candidateStart: at(candidate),
    maxPerWeek: 2,
    minDaysBetween: 2,
    timeZone: TZ,
  });

describe("checkWeeklyLimit", () => {
  it("permite el primer turno de la semana", () => {
    expect(limit([], "2026-10-12T15:00").ok).toBe(true);
  });

  it("permite lunes y miércoles", () => {
    expect(limit(["2026-10-12T15:00"], "2026-10-14T21:00").ok).toBe(true);
  });

  it("rechaza lunes y martes", () => {
    expect(limit(["2026-10-12T22:00"], "2026-10-13T15:00").ok).toBe(false);
  });

  it("rechaza dos turnos el mismo día", () => {
    expect(limit(["2026-10-12T15:00"], "2026-10-12T20:00").ok).toBe(false);
  });

  it("rechaza un tercer turno", () => {
    expect(limit(["2026-10-12T15:00", "2026-10-14T15:00"], "2026-10-17T15:00").ok).toBe(false);
  });
});

describe("canCancelOnline", () => {
  const start = at("2026-10-12T20:00");
  it("permite cancelar con 5 horas exactas", () => {
    expect(canCancelOnline(start, at("2026-10-12T15:00"), 5)).toBe(true);
  });
  it("no permite cancelar a menos de 5 horas", () => {
    expect(canCancelOnline(start, at("2026-10-12T15:01"), 5)).toBe(false);
  });
});

describe("isOnlineBookingBlocked", () => {
  it("bloquea a partir de 10 faltas", () => {
    expect(isOnlineBookingBlocked(9, 10)).toBe(false);
    expect(isOnlineBookingBlocked(10, 10)).toBe(true);
  });
});

describe("effectiveStatus", () => {
  const end = at("2026-10-12T16:00");
  it("un turno confirmado que ya terminó cuenta como asistido", () => {
    expect(effectiveStatus("CONFIRMED", end, at("2026-10-12T16:00"))).toBe("ATTENDED");
  });
  it("un turno confirmado futuro sigue confirmado", () => {
    expect(effectiveStatus("CONFIRMED", end, at("2026-10-12T15:59"))).toBe("CONFIRMED");
  });
  it("no pisa una falta marcada", () => {
    expect(effectiveStatus("NO_SHOW", end, at("2026-10-13T10:00"))).toBe("NO_SHOW");
  });
});
