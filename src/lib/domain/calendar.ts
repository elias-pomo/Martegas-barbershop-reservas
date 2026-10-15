export interface CalendarEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location?: string | null;
  description?: string;
  url?: string;
  /** Minutos antes del inicio en que avisa el calendario. */
  alarmsMin?: number[];
}

/** 2026-10-15T21:00:00.000Z → 20261015T210000Z */
function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Corta líneas a 75 octetos como pide RFC 5545 (las siguientes empiezan con un espacio). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const len = new TextEncoder().encode(char).length;
    if (size + len > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += len;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function alarmTrigger(min: number): string {
  if (min % 1440 === 0) return `-P${min / 1440}D`;
  if (min % 60 === 0) return `-PT${min / 60}H`;
  return `-PT${min}M`;
}

/** Archivo .ics con alarmas, compatible con Apple Calendar, Google y Outlook. */
export function buildIcs(event: CalendarEvent, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Agendapp//Turnos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(event.end)}`,
    `SUMMARY:${icsText(event.title)}`,
    ...(event.location ? [`LOCATION:${icsText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${icsText(event.description)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    ...(event.alarmsMin ?? []).flatMap((min) => [
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(event.title)}`,
      `TRIGGER:${alarmTrigger(min)}`,
      "END:VALARM",
    ]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Link "Agregar a Google Calendar" (usa las notificaciones por defecto del usuario). */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${icsDate(event.start)}/${icsDate(event.end)}`,
  });
  if (event.location) params.set("location", event.location);
  if (event.description) params.set("details", event.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
