"use server";

import { z } from "zod";
import { findByPhoneAndCode, getStatusesByTokens, type LookupResult } from "@/lib/appointments";

const lookupSchema = z.object({
  slug: z.string().min(1),
  phone: z.string().trim().min(6).max(30),
  code: z.string().regex(/^\d{4}$/),
});

export async function lookupAppointment(input: z.input<typeof lookupSchema>): Promise<LookupResult> {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ingresá tu teléfono y el código de 4 dígitos." };
  return findByPhoneAndCode(parsed.data.slug, parsed.data.phone, parsed.data.code);
}

export async function getAppointmentStatuses(slug: string, tokens: string[]) {
  const valid = z.array(z.string().max(64)).max(20).safeParse(tokens);
  if (!valid.success) return {};
  return getStatusesByTokens(slug, valid.data);
}
