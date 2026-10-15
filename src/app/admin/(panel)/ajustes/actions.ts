"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import {
  changeOwnPassword,
  saveServices,
  saveWorkingHours,
  updateBusinessInfo,
  updateSettings,
  type SettingsResult,
} from "@/lib/admin-settings";
import { createSession, requireAdmin } from "@/lib/auth";
import { businessTag } from "@/lib/business";

const fail = (error: z.ZodError): SettingsResult => ({ ok: false, message: error.issues[0]?.message ?? "Datos inválidos." });

/** Ejecuta un cambio y, si salió bien, invalida el caché público del negocio. */
async function withBusiness(run: (business: Awaited<ReturnType<typeof requireAdmin>>["business"]) => Promise<SettingsResult>) {
  const { business } = await requireAdmin();
  const result = await run(business);
  if (result.ok) updateTag(businessTag(business.slug));
  return result;
}

const infoSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del negocio").max(80),
  address: z.string().max(150),
  whatsapp: z.string().max(30),
  instagram: z.union([z.literal(""), z.url("El link de Instagram no es válido")]),
  paymentAlias: z.string().max(60),
  paymentHolder: z.string().max(80),
});

export async function saveInfo(input: z.input<typeof infoSchema>) {
  const parsed = infoSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  return withBusiness((b) => updateBusinessInfo(b, parsed.data));
}

const servicesSchema = z
  .array(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(2, "Cada servicio necesita un nombre").max(60),
      description: z.string().trim().max(140, "La descripción puede tener hasta 140 caracteres").default(""),
      durationMin: z.number().int().min(15).max(480),
      price: z.number().int().min(0, "Precio inválido").max(10_000_000),
      active: z.boolean(),
    }),
  )
  .min(1)
  .max(30);

export async function saveServicesAction(input: z.input<typeof servicesSchema>) {
  const parsed = servicesSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  return withBusiness((b) => saveServices(b, parsed.data));
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida");
const hoursSchema = z
  .array(z.object({ weekday: z.number().int().min(0).max(6), open: z.boolean(), firstStart: hhmm, lastStart: hhmm }))
  .length(7);

export async function saveHoursAction(input: z.input<typeof hoursSchema>) {
  const parsed = hoursSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  return withBusiness((b) => saveWorkingHours(b, parsed.data));
}

const policiesSchema = z.object({
  slotIntervalMin: z.number().int().refine((n) => [15, 30, 60].includes(n), "Intervalo inválido"),
  minLeadMin: z.number().int().min(0).max(1440),
  cancelMinHours: z.number().min(0).max(72),
  maxPerWeek: z.number().int().min(1).max(7),
  minDaysBetween: z.number().int().min(0).max(6),
  noShowBlockThreshold: z.number().int().min(1).max(100),
  specialSurchargePerPerson: z.number().int().min(0).max(1_000_000),
});

export async function savePolicies(input: z.input<typeof policiesSchema>) {
  const parsed = policiesSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  return withBusiness((b) => updateSettings(b, parsed.data));
}

const templatesSchema = z.object({
  reminder: z.string().trim().min(5).max(500),
  businessCancel: z.string().trim().min(5).max(500),
  confirmation: z.string().trim().min(5).max(500),
  waitlistOffer: z.string().trim().min(5).max(500),
  generic: z.string().max(500),
});

export async function saveTemplates(input: z.input<typeof templatesSchema>) {
  const parsed = templatesSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  return withBusiness((b) => updateSettings(b, { waTemplates: parsed.data }));
}

export async function changePassword(current: string, next: string): Promise<SettingsResult> {
  if (typeof current !== "string" || typeof next !== "string") return { ok: false, message: "Datos inválidos." };
  const { userId, business } = await requireAdmin();
  const result = await changeOwnPassword(userId, current, next);
  if (!result.ok) return result;
  // Se cerraron todas las sesiones; esta se re-emite para no sacar al barbero del panel.
  await createSession({ userId, businessId: business.id, version: result.version });
  return { ok: true };
}
