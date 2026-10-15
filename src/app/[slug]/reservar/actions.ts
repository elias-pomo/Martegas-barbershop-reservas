"use server";

import { after } from "next/server";
import { z } from "zod";
import { createBooking, type BookingResult } from "@/lib/booking";
import { notifyAppointment } from "@/lib/notifications";
import { joinWaitlist, type WaitlistResult } from "@/lib/waitlist";

const bookingSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  startsAt: z.iso.datetime(),
  name: z.string().trim().min(2, "Ingresá tu nombre").max(60),
  phone: z.string().trim().min(6, "Ingresá tu teléfono").max(30),
});

const waitlistSchema = z.object({
  slug: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().optional(),
  name: z.string().trim().min(2, "Ingresá tu nombre").max(60),
  phone: z.string().trim().min(6, "Ingresá tu teléfono").max(30),
});

export async function joinWaitlistAction(input: z.input<typeof waitlistSchema>): Promise<WaitlistResult> {
  const parsed = waitlistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { slug, ...rest } = parsed.data;
  return joinWaitlist(slug, rest);
}

export async function bookAppointment(input: z.input<typeof bookingSchema>): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code = issue.path[0] === "phone" ? "INVALID_PHONE" : "INVALID_INPUT";
    return { ok: false, error: { code, message: issue.message } };
  }
  const { startsAt, ...rest } = parsed.data;
  const result = await createBooking({ ...rest, startsAt: new Date(startsAt) });
  // El aviso al barbero sale después de responderle al cliente: no lo hace esperar.
  if (result.ok) after(() => notifyAppointment("booked", result.appointment.token));
  return result;
}
