import { appointmentEvent } from "@/lib/appointment-calendar";
import { getAppointmentByToken } from "@/lib/appointments";
import { buildIcs } from "@/lib/domain/calendar";

export async function GET(request: Request, { params }: RouteContext<"/api/[slug]/turno/[token]/ics">) {
  const { slug, token } = await params;
  const found = await getAppointmentByToken(slug, token);
  if (!found) return new Response("Turno no encontrado", { status: 404 });

  const { business, appointment } = found;
  const ics = buildIcs(
    appointmentEvent({
      token,
      slug,
      businessName: business.name,
      address: business.address,
      serviceName: appointment.serviceName,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      origin: new URL(request.url).origin,
    }),
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // inline: en iPhone abre directamente "Agregar al calendario".
      "Content-Disposition": 'inline; filename="turno.ics"',
      "Cache-Control": "no-store",
    },
  });
}
