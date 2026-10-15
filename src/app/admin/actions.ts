"use server";

import { z } from "zod";
import {
  createBlock,
  createManualAppointment,
  deleteBlock,
  markReminderSent,
  setAppointmentStatus,
  setPayment,
  type ActionResult,
} from "@/lib/admin";
import { renameCustomer } from "@/lib/admin-customers";
import { requireAdmin } from "@/lib/auth";
import { deleteSubscription, hasSubscription, notifyBusiness, saveSubscription } from "@/lib/push";
import { setWaitlistStatus } from "@/lib/waitlist";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);

const invalid = (error: z.ZodError): { ok: false; message: string } => ({
  ok: false,
  message: error.issues[0]?.message ?? "Datos inválidos.",
});

export async function changeStatus(id: string, status: "NO_SHOW" | "LATE_CANCEL" | "CANCELLED_BY_BUSINESS" | "ATTENDED") {
  const parsed = z
    .object({ id: z.string().min(1), status: z.enum(["NO_SHOW", "LATE_CANCEL", "CANCELLED_BY_BUSINESS", "ATTENDED"]) })
    .safeParse({ id, status });
  if (!parsed.success) return invalid(parsed.error);
  const { business } = await requireAdmin();
  return setAppointmentStatus(business, parsed.data.id, parsed.data.status);
}

const manualSchema = z
  .object({
    day,
    time,
    type: z.enum(["REGULAR", "SPECIAL"]),
    serviceId: z.string().optional(),
    durationMin: z.coerce.number().int().min(15, "Duración mínima: 15 minutos").max(600),
    price: z.coerce.number().int().min(0, "Precio inválido").max(10_000_000),
    people: z.coerce.number().int().min(1).max(20),
    address: z.string().max(200).optional(),
    notes: z.string().max(300).optional(),
    name: z.string().trim().min(2, "Ingresá el nombre").max(60),
    phone: z.string().trim().min(6, "Ingresá el teléfono").max(30),
  })
  .refine((v) => v.type === "SPECIAL" || !!v.serviceId, { message: "Elegí un servicio", path: ["serviceId"] });

export async function addAppointment(input: z.input<typeof manualSchema>) {
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { business } = await requireAdmin();
  return createManualAppointment(business, parsed.data);
}

const blockSchema = z
  .object({
    day,
    allDay: z.boolean(),
    from: time.optional(),
    to: time.optional(),
    reason: z.string().max(100).optional(),
    cancelConflicts: z.boolean(),
  })
  .refine((v) => v.allDay || (v.from && v.to), { message: "Indicá desde y hasta qué hora" });

export async function addBlock(input: z.input<typeof blockSchema>) {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { business } = await requireAdmin();
  return createBlock(business, parsed.data);
}

export async function updateCustomerName(id: string, name: string): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().min(1), name: z.string().trim().min(2, "Nombre muy corto").max(60) }).safeParse({ id, name });
  if (!parsed.success) return invalid(parsed.error);
  const { business } = await requireAdmin();
  const ok = await renameCustomer(business, parsed.data.id, parsed.data.name);
  return ok ? { ok: true } : { ok: false, message: "Cliente no encontrado." };
}

export async function registerPayment(id: string, method: "CASH" | "TRANSFER" | null): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().min(1), method: z.enum(["CASH", "TRANSFER"]).nullable() }).safeParse({ id, method });
  if (!parsed.success) return invalid(parsed.error);
  const { business } = await requireAdmin();
  return setPayment(business, parsed.data.id, parsed.data.method);
}

export async function reminderSent(id: string): Promise<ActionResult> {
  if (typeof id !== "string" || !id) return { ok: false, message: "Turno inválido." };
  const { business } = await requireAdmin();
  return markReminderSent(business, id);
}

export async function updateWaitlist(id: string, status: "CONTACTED" | "CLOSED"): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().min(1), status: z.enum(["CONTACTED", "CLOSED"]) }).safeParse({ id, status });
  if (!parsed.success) return invalid(parsed.error);
  const { business } = await requireAdmin();
  return setWaitlistStatus(business, parsed.data.id, parsed.data.status);
}

/* ---------- Notificaciones push ---------- */

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function subscribePush(subscription: unknown): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false, message: "Suscripción inválida." };
  const { userId } = await requireAdmin();
  await saveSubscription(userId, parsed.data);
  return { ok: true };
}

export async function unsubscribePush(endpoint: string): Promise<ActionResult> {
  if (typeof endpoint !== "string") return { ok: false, message: "Datos inválidos." };
  const { userId } = await requireAdmin();
  await deleteSubscription(userId, endpoint);
  return { ok: true };
}

export async function isPushRegistered(endpoint: string): Promise<boolean> {
  if (typeof endpoint !== "string") return false;
  const { userId } = await requireAdmin();
  return hasSubscription(userId, endpoint);
}

export async function sendTestPush(): Promise<ActionResult> {
  const { business } = await requireAdmin();
  const sent = await notifyBusiness(business.id, {
    title: "¡Avisos activados!",
    body: "Así te va a llegar cada turno nuevo o cancelado.",
    url: "/admin",
    tag: "prueba",
  });
  return sent > 0 ? { ok: true } : { ok: false, message: "No se pudo enviar. Probá desactivar y volver a activar." };
}

export async function removeBlock(id: string): Promise<ActionResult> {
  if (typeof id !== "string" || !id) return { ok: false, message: "Bloqueo inválido." };
  const { business } = await requireAdmin();
  return deleteBlock(business, id);
}
