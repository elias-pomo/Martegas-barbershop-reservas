import { describe, expect, it } from "vitest";
import { monthRange, monthStartOf } from "./time";

const TZ = "America/Argentina/Tucuman";

describe("monthRange", () => {
  it("usa la medianoche local de Tucumán (UTC-3)", () => {
    const { start, end } = monthRange("2026-10-15", TZ);
    expect(start.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("cruza el año hacia atrás y hacia adelante", () => {
    expect(monthStartOf("2026-01-20", -1)).toBe("2025-12-01");
    expect(monthStartOf("2026-12-05", 1)).toBe("2027-01-01");
  });
});
