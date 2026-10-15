/**
 * Turnos y datos del cliente guardados en el dispositivo (sin cuenta).
 * localStorage puede no estar disponible (modo privado): todo falla en silencio.
 */

export interface SavedAppointment {
  token: string;
  code: string;
  startsAt: string;
  endsAt: string;
  serviceName: string;
  price: number;
}

export interface SavedContact {
  name: string;
  phone: string;
}

const appointmentsKey = (slug: string) => `agendapp:${slug}:turnos`;
const contactKey = "agendapp:contacto";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin almacenamiento disponible
  }
}

export function getSavedAppointments(slug: string): SavedAppointment[] {
  return read<SavedAppointment[]>(appointmentsKey(slug), []);
}

export function saveAppointment(slug: string, appointment: SavedAppointment) {
  const now = Date.now();
  // Se descartan los turnos que ya pasaron hace más de un día.
  const kept = getSavedAppointments(slug).filter(
    (a) => a.token !== appointment.token && new Date(a.endsAt).getTime() > now - 86_400_000,
  );
  write(appointmentsKey(slug), [...kept, appointment]);
}

export function removeSavedAppointment(slug: string, token: string) {
  write(appointmentsKey(slug), getSavedAppointments(slug).filter((a) => a.token !== token));
}

export function getSavedContact(): SavedContact | null {
  return read<SavedContact | null>(contactKey, null);
}

export function saveContact(contact: SavedContact) {
  write(contactKey, contact);
}
