"use server";

import { z } from "zod";
import { createBooking, type BookingResult } from "@/lib/booking";

const bookingSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  startsAt: z.iso.datetime(),
  name: z.string().trim().min(2, "Ingresá tu nombre").max(60),
  phone: z.string().trim().min(6, "Ingresá tu teléfono").max(30),
});

export async function bookAppointment(input: z.input<typeof bookingSchema>): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code = issue.path[0] === "phone" ? "INVALID_PHONE" : "INVALID_INPUT";
    return { ok: false, error: { code, message: issue.message } };
  }
  const { startsAt, ...rest } = parsed.data;
  return createBooking({ ...rest, startsAt: new Date(startsAt) });
}
