"use server";

import { z } from "zod";
import {
  createBlock,
  createManualAppointment,
  deleteBlock,
  setAppointmentStatus,
  type ActionResult,
} from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";

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

export async function removeBlock(id: string): Promise<ActionResult> {
  if (typeof id !== "string" || !id) return { ok: false, message: "Bloqueo inválido." };
  const { business } = await requireAdmin();
  return deleteBlock(business, id);
}
