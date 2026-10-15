import { describe, expect, it } from "vitest";
import { serviceKind } from "./service-icon";

describe("serviceKind", () => {
  it.each([
    ["Corte", "tijera"],
    ["Corte + barba", "navaja"],
    ["Perfilado de barba", "navaja"],
    ["Afeitado clásico", "navaja"],
    ["Degradé", "maquina"],
    ["Corte a máquina", "maquina"],
    ["Lavado", "tijera"],
  ])("%s → %s", (name, kind) => {
    expect(serviceKind(name)).toBe(kind);
  });
});
