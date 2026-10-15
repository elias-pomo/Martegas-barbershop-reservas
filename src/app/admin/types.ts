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
  day: string;
  today: string;
  week: { date: string; count: number }[];
  entries: AgendaEntry[];
}
