import "server-only";
import { db } from "./db";
import { localDateOf } from "./domain/time";
import { notifyBusiness, type PushPayload } from "./push";
import { countWaiting } from "./waitlist";

/** Texto de la notificación al barbero. Puro, para poder testearlo. */
export function appointmentPayload(
  kind: "booked" | "cancelled",
  a: { customerName: string; serviceName: string; startsAt: Date; timeZone: string; waiting?: number },
): PushPayload {
  const when = a.startsAt.toLocaleString("es-AR", {
    timeZone: a.timeZone,
    weekday: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const day = localDateOf(a.startsAt, a.timeZone);
  return kind === "booked"
    ? {
        title: `Nuevo turno · ${when}`,
        body: `${a.customerName} — ${a.serviceName}`,
        url: `/admin?dia=${day}`,
        tag: `turno-${a.startsAt.toISOString()}`,
      }
    : {
        title: `Turno cancelado · ${when}`,
        body: a.waiting
          ? `${a.customerName} canceló. Hay ${a.waiting} en lista de espera: ofrecele el lugar.`
          : `${a.customerName} canceló ${a.serviceName.toLowerCase()}. El horario quedó libre.`,
        url: `/admin?dia=${day}`,
        tag: `turno-${a.startsAt.toISOString()}`,
      };
}

/** Avisa al barbero de una reserva o cancelación hecha por un cliente desde la web. */
export async function notifyAppointment(kind: "booked" | "cancelled", cancelToken: string) {
  try {
    const appointment = await db.appointment.findUnique({
      where: { cancelToken },
      include: { customer: true, service: true, business: true },
    });
    if (!appointment) return;
    const waiting =
      kind === "cancelled"
        ? await countWaiting(appointment.businessId, localDateOf(appointment.startsAt, appointment.business.timezone))
        : 0;
    await notifyBusiness(
      appointment.businessId,
      appointmentPayload(kind, {
        customerName: appointment.customer.name,
        serviceName: appointment.service?.name ?? "Turno especial",
        startsAt: appointment.startsAt,
        timeZone: appointment.business.timezone,
        waiting,
      }),
    );
  } catch (e) {
    console.error("[push] no se pudo avisar del turno:", e);
  }
}
