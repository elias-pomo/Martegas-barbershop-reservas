import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "./calendar";

const event: CalendarEvent = {
  uid: "abc@agendapp",
  title: "Corte + barba · Martega's Barber Shop",
  start: new Date("2026-10-15T21:00:00Z"),
  end: new Date("2026-10-15T22:30:00Z"),
  location: "Lavalle 856, San Miguel de Tucumán",
  description: "Para ver o cancelar tu turno: https://example.com/martegas/turno/abc",
  url: "https://example.com/martegas/turno/abc",
  alarmsMin: [1440, 120],
};

describe("buildIcs", () => {
  const ics = buildIcs(event, new Date("2026-10-15T12:00:00Z"));

  it("usa horarios en UTC", () => {
    expect(ics).toContain("DTSTART:20261015T210000Z");
    expect(ics).toContain("DTEND:20261015T223000Z");
  });

  it("incluye alarmas de 1 día y 2 horas antes", () => {
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("TRIGGER:-PT2H");
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
  });

  it("escapa comas en el texto", () => {
    expect(ics).toContain("LOCATION:Lavalle 856\\, San Miguel de Tucumán");
  });

  it("usa CRLF y ninguna línea supera 75 octetos", () => {
    const lines = ics.split("\r\n");
    expect(lines.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("al desplegar las líneas plegadas se recupera el texto", () => {
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain(`URL:${event.url}`);
  });
});

describe("googleCalendarUrl", () => {
  it("arma el link con fechas y datos", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20261015T210000Z/20261015T223000Z");
    expect(url.searchParams.get("location")).toBe(event.location);
  });
});
