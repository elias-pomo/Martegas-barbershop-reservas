import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";
import { renderTemplate, waLink } from "./whatsapp";

describe("normalizePhone", () => {
  const expected = "+5493811234567";

  it.each([
    "3811234567",
    "381 123-4567",
    "0381 15 1234567",
    "381 15 1234567",
    "+54 9 381 123 4567",
    "+54 381 1234567",
    "5493811234567",
  ])("normaliza %s", (input) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("completa la característica del negocio si falta", () => {
    expect(normalizePhone("1234567", "381")).toBe(expected);
    expect(normalizePhone("15 1234567", "381")).toBe(expected);
  });

  it("acepta números de Buenos Aires", () => {
    expect(normalizePhone("11 15 2345 6789")).toBe("+5491123456789");
  });

  it("acepta números extranjeros con +", () => {
    expect(normalizePhone("+34 641 31 12 13")).toBe("+34641311213");
  });

  it("rechaza números incompletos", () => {
    expect(normalizePhone("1234567")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("whatsapp", () => {
  it("arma el link wa.me con el texto codificado", () => {
    expect(waLink("+34641311213", "Hola Juan!")).toBe("https://wa.me/34641311213?text=Hola%20Juan!");
  });

  it("reemplaza variables y deja las desconocidas", () => {
    expect(renderTemplate("Hola {nombre}, {otra}", { nombre: "Juan" })).toBe("Hola Juan, {otra}");
  });
});
