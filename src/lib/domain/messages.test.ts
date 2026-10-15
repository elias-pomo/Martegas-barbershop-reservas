import { describe, expect, it } from "vitest";
import {
  businessCancelLink,
  confirmationLink,
  relativeDay,
  reminderLink,
  waitlistOfferLink,
  type MessageContext,
} from "./messages";
import { parseSettings } from "./settings";

const TZ = "America/Argentina/Tucuman";
const at = (local: string) => new Date(`${local}:00-03:00`);

const ctx: MessageContext = {
  businessName: "Martega's Barber Shop",
  address: "Lavalle 856",
  timeZone: TZ,
  templates: parseSettings({}).waTemplates,
  origin: "https://agendapp.test",
  slug: "martegas",
};

const appointment = {
  customerName: "Juan Pérez",
  phone: "+5493811234567",
  serviceName: "Corte",
  startsAt: at("2026-10-15T18:00"),
  token: "tok123",
};

const text = (link: string) => decodeURIComponent(new URL(link).searchParams.get("text")!);

describe("relativeDay", () => {
  it("dice hoy, mañana o el día", () => {
    expect(relativeDay(at("2026-10-15T18:00"), at("2026-10-15T09:00"), TZ)).toBe("hoy");
    expect(relativeDay(at("2026-10-16T18:00"), at("2026-10-15T23:30"), TZ)).toBe("mañana");
    expect(relativeDay(at("2026-10-17T18:00"), at("2026-10-15T09:00"), TZ)).toBe("el sábado, 17 de octubre");
  });
});

describe("mensajes de WhatsApp", () => {
  it("recordatorio con nombre de pila, hora y dirección", () => {
    const link = reminderLink(ctx, appointment, at("2026-10-15T10:00"));
    expect(link.startsWith("https://wa.me/5493811234567?text=")).toBe(true);
    expect(text(link)).toBe(
      "Hola Juan! Te recuerdo tu turno de Corte hoy a las 18:00 en Martega's Barber Shop, Lavalle 856. ¡Te espero!",
    );
  });

  it("cancelación del negocio con link para reservar", () => {
    expect(text(businessCancelLink(ctx, appointment))).toContain("https://agendapp.test/martegas/reservar");
  });

  it("oferta de lugar liberado a la lista de espera", () => {
    const t = text(waitlistOfferLink(ctx, { name: "Ana López", phone: "+5493818000001", day: "2026-10-16" }));
    expect(t).toContain("Hola Ana!");
    expect(t).toContain("viernes, 16 de octubre");
    expect(t).toContain("https://agendapp.test/martegas/reservar");
  });

  it("confirmación de turno cargado a mano con link y código", () => {
    const t = text(confirmationLink(ctx, { ...appointment, code: "4821" }, at("2026-10-14T10:00")));
    expect(t).toContain("mañana a las 18:00");
    expect(t).toContain("https://agendapp.test/martegas/turno/tok123");
    expect(t).toContain("código 4821");
  });
});
