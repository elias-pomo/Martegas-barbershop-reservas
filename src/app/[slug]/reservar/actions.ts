"use server";

import { after } from "next/server";
import { z } from "zod";
import { createBooking, type BookingResult } from "@/lib/booking";
import { clientIp } from "@/lib/client-ip";
import { notifyAppointment } from "@/lib/notifications";
import { bookingLimited, recordBooking, recordWaitlist, waitlistLimited } from "@/lib/public-limits";
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
  const ip = await clientIp();
  if (await waitlistLimited(slug, ip)) {
    return { ok: false, message: "Ya te anotaste varias veces. Si necesitás algo más, escribile por WhatsApp." };
  }
  const result = await joinWaitlist(slug, rest);
  if (result.ok) await recordWaitlist(slug, ip);
  return result;
}

export async function bookAppointment(input: z.input<typeof bookingSchema>): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code = issue.path[0] === "phone" ? "INVALID_PHONE" : "INVALID_INPUT";
    return { ok: false, error: { code, message: issue.message } };
  }
  const { startsAt, ...rest } = parsed.data;
  const ip = await clientIp();
  if (await bookingLimited(rest.slug, ip)) {
    return {
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "Hiciste varias reservas seguidas desde este dispositivo. Si necesitás otro turno, escribile por WhatsApp.",
      },
    };
  }
  const result = await createBooking({ ...rest, startsAt: new Date(startsAt) });
  if (result.ok) {
    await recordBooking(rest.slug, ip);
    // El aviso al barbero sale después de responderle al cliente: no lo hace esperar.
    after(() => notifyAppointment("booked", result.appointment.token));
  }
  return result;
}
