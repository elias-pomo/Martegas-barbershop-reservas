import type { BusinessSettings } from "./settings";
import { addLocalDays, localDateOf } from "./time";
import { renderTemplate, waLink } from "./whatsapp";

export interface MessageContext {
  businessName: string;
  address: string | null;
  timeZone: string;
  templates: BusinessSettings["waTemplates"];
  /** Origen absoluto del sitio, para armar links (`https://…`). */
  origin: string;
  slug: string;
}

export interface MessageAppointment {
  customerName: string;
  phone: string;
  serviceName: string;
  startsAt: Date | string;
  token: string;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function time(d: Date, tz: string) {
  return d.toLocaleTimeString("es-AR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
}

function longDay(d: Date, tz: string) {
  return d.toLocaleDateString("es-AR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" });
}

/** "hoy", "mañana" o "el jueves 15 de octubre". */
export function relativeDay(start: Date, now: Date, tz: string): string {
  const day = localDateOf(start, tz);
  const today = localDateOf(now, tz);
  if (day === today) return "hoy";
  if (day === addLocalDays(today, 1)) return "mañana";
  return `el ${longDay(start, tz)}`;
}

function vars(ctx: MessageContext, a: MessageAppointment, now: Date, extra: Record<string, string> = {}) {
  const start = new Date(a.startsAt);
  return {
    nombre: firstName(a.customerName),
    servicio: a.serviceName,
    cuando: relativeDay(start, now, ctx.timeZone),
    dia: longDay(start, ctx.timeZone),
    hora: time(start, ctx.timeZone),
    negocio: ctx.businessName,
    direccion: ctx.address ?? "",
    link: `${ctx.origin}/${ctx.slug}/reservar`,
    ...extra,
  };
}

export function reminderLink(ctx: MessageContext, a: MessageAppointment, now = new Date()) {
  return waLink(a.phone, renderTemplate(ctx.templates.reminder, vars(ctx, a, now)));
}

export function businessCancelLink(ctx: MessageContext, a: MessageAppointment, now = new Date()) {
  return waLink(a.phone, renderTemplate(ctx.templates.businessCancel, vars(ctx, a, now)));
}

export function confirmationLink(ctx: MessageContext, a: MessageAppointment & { code: string }, now = new Date()) {
  return waLink(
    a.phone,
    renderTemplate(
      ctx.templates.confirmation,
      vars(ctx, a, now, { link: `${ctx.origin}/${ctx.slug}/turno/${a.token}`, codigo: a.code }),
    ),
  );
}

export function genericLink(ctx: MessageContext, a: Pick<MessageAppointment, "customerName" | "phone">) {
  return waLink(a.phone, renderTemplate(ctx.templates.generic, { nombre: firstName(a.customerName) }));
}
