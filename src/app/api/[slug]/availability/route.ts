import { getServiceAvailability } from "@/lib/booking";

export type AvailabilityResponse = {
  timeZone: string;
  days: { date: string; open: boolean; slots: string[] }[];
};

export async function GET(request: Request, { params }: RouteContext<"/api/[slug]/availability">) {
  const { slug } = await params;
  const serviceId = new URL(request.url).searchParams.get("serviceId");
  if (!serviceId) return Response.json({ error: "Falta serviceId" }, { status: 400 });

  const result = await getServiceAvailability(slug, serviceId);
  if (!result) return Response.json({ error: "No encontrado" }, { status: 404 });

  const body: AvailabilityResponse = {
    timeZone: result.business.timezone,
    days: result.days.map((d) => ({
      date: d.date,
      open: d.open,
      slots: d.slots.map((s) => s.start.toISOString()),
    })),
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
