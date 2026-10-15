import type { AppointmentStatus } from "@/lib/domain/rules";
import type { BusinessSettings } from "@/lib/domain/settings";

/** Datos serializables que el servidor le pasa a la agenda del panel. */

export interface AgendaAppointment {
  id: string;
  start: string;
  end: string;
  active: boolean;
  status: AppointmentStatus;
  type: "REGULAR" | "SPECIAL";
  token: string;
  price: number;
  notes: string | null;
  address: string | null;
  people: number;
  serviceName: string;
  customer: { id: string; name: string; phone: string };
  customerNoShows: number;
  paymentMethod: "CASH" | "TRANSFER" | null;
  reminderSentAt: string | null;
}

export interface WaitlistItem {
  id: string;
  day: string;
  name: string;
  phone: string;
  status: "WAITING" | "CONTACTED";
  serviceName: string | null;
}

export interface AgendaBlock {
  id: string;
  start: string;
  end: string;
  reason: string | null;
}

export type AgendaEntry =
  | { kind: "appointment"; start: string; item: AgendaAppointment }
  | { kind: "block"; start: string; item: AgendaBlock }
  | { kind: "free"; start: string };

export interface AgendaBusiness {
  slug: string;
  name: string;
  address: string | null;
  timeZone: string;
  templates: BusinessSettings["waTemplates"];
  services: { id: string; name: string; durationMin: number; price: number }[];
  specialSurchargePerPerson: number;
}

export interface AgendaData {
  business: AgendaBusiness;
  /** Hora del servidor al armar la página (ISO), para decidir qué turnos ya empezaron. */
  now: string;
  day: string;
  today: string;
  week: { date: string; count: number }[];
  waitlist: WaitlistItem[];
  entries: AgendaEntry[];
}
