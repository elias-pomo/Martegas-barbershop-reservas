import type { CalendarEvent } from "./domain/calendar";

/** Evento de calendario de un turno. Sirve en servidor (.ics) y cliente (link de Google). */
export function appointmentEvent(params: {
  token: string;
  slug: string;
  businessName: string;
  address: string | null;
  serviceName: string;
  startsAt: string | Date;
  endsAt: string | Date;
  origin: string;
}): CalendarEvent {
  const url = `${params.origin}/${params.slug}/turno/${params.token}`;
  return {
    uid: `${params.token}@agendapp`,
    title: `${params.serviceName} · ${params.businessName}`,
    start: new Date(params.startsAt),
    end: new Date(params.endsAt),
    location: params.address,
    description: `Para ver o cancelar tu turno: ${url}`,
    url,
    alarmsMin: [1440, 120],
  };
}

export const icsUrl = (slug: string, token: string) => `/api/${slug}/turno/${token}/ics`;
