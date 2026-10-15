import { describe, expect, it } from "vitest";
import {
  bookingWindow,
  getAvailability,
  isSlotAvailable,
  type AvailabilityInput,
  type WorkingBlock,
} from "./availability";

const TZ = "America/Argentina/Tucuman";
/** Hora local de Tucumán (UTC-3). Semana de referencia: dom 11/10/2026 … sáb 17/10/2026. */
const at = (local: string) => new Date(`${local}:00-03:00`);

const MON_TO_SAT: WorkingBlock[] = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  firstStart: "15:00",
  lastStart: "22:00",
}));

function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    now: at("2026-10-12T09:00"),
    timeZone: TZ,
    weekStartsOn: 0,
    slotIntervalMin: 60,
    minLeadMin: 15,
    durationMin: 60,
    workingHours: MON_TO_SAT,
    busy: [],
    ...overrides,
  };
}

const hours = (slots: { start: Date }[]) =>
  slots.map((s) =>
    s.start.toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }),
  );

describe("bookingWindow", () => {
  it("un lunes muestra lunes a sábado de esa semana", () => {
    expect(bookingWindow(at("2026-10-12T09:00"), TZ, 0)).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17",
    ]);
  });

  it("un sábado a la noche solo muestra el sábado", () => {
    expect(bookingWindow(at("2026-10-17T23:59"), TZ, 0)).toEqual(["2026-10-17"]);
  });

  it("el domingo a las 00:00 se habilita la semana siguiente completa", () => {
    const days = bookingWindow(at("2026-10-18T00:00"), TZ, 0);
    expect(days[0]).toBe("2026-10-18");
    expect(days.at(-1)).toBe("2026-10-24");
    expect(days).toHaveLength(7);
  });

  it("usa la hora de Tucumán aunque en UTC ya sea otro día", () => {
    // Sábado 22:30 en Tucumán = domingo 01:30 UTC → sigue siendo sábado.
    expect(bookingWindow(at("2026-10-17T22:30"), TZ, 0)).toEqual(["2026-10-17"]);
  });
});

describe("getAvailability", () => {
  it("ofrece inicios cada 1 hora de 15:00 a 22:00 (22:00 es el último inicio)", () => {
    const monday = getAvailability(input())[0];
    expect(monday.open).toBe(true);
    expect(hours(monday.slots)).toEqual(["15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"]);
  });

  it("el domingo figura como cerrado", () => {
    const sunday = getAvailability(input({ now: at("2026-10-18T10:00") }))[0];
    expect(sunday).toMatchObject({ date: "2026-10-18", open: false, slots: [] });
  });

  it("respeta la anticipación mínima de 15 minutos", () => {
    const at1450 = getAvailability(input({ now: at("2026-10-12T14:45") }))[0];
    expect(hours(at1450.slots)[0]).toBe("15:00");
    const at1446 = getAvailability(input({ now: at("2026-10-12T14:46") }))[0];
    expect(hours(at1446.slots)[0]).toBe("16:00");
  });

  it("un corte + barba (90 min) bloquea el inicio siguiente", () => {
    const busy = [{ start: at("2026-10-12T15:00"), end: at("2026-10-12T16:30") }];
    const monday = getAvailability(input({ busy }))[0];
    expect(hours(monday.slots)).not.toContain("15:00");
    expect(hours(monday.slots)).not.toContain("16:00");
    expect(hours(monday.slots)[0]).toBe("17:00");
  });

  it("un corte + barba no entra si se pisa con el turno siguiente", () => {
    const busy = [{ start: at("2026-10-12T16:00"), end: at("2026-10-12T17:00") }];
    const monday = getAvailability(input({ busy, durationMin: 90 }))[0];
    expect(hours(monday.slots)).not.toContain("15:00"); // 15:00–16:30 pisa 16:00
    expect(hours(monday.slots)).toContain("17:00");
  });

  it("los bloqueos del barbero ocultan horarios", () => {
    const busy = [{ start: at("2026-10-13T00:00"), end: at("2026-10-14T00:00") }];
    const tuesday = getAvailability(input({ busy }))[1];
    expect(tuesday).toMatchObject({ date: "2026-10-13", open: true, slots: [] });
  });

  it("isSlotAvailable valida un inicio puntual", () => {
    expect(isSlotAvailable(input(), at("2026-10-12T18:00"))).toBe(true);
    expect(isSlotAvailable(input(), at("2026-10-12T18:30"))).toBe(false); // fuera de grilla
    expect(isSlotAvailable(input(), at("2026-10-19T18:00"))).toBe(false); // semana siguiente
    expect(isSlotAvailable(input(), at("2026-10-12T23:00"))).toBe(false); // después del último inicio
  });
});
