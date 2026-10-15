"use server";

import { after } from "next/server";
import { cancelByToken, type CancelResult } from "@/lib/appointments";
import { notifyAppointment } from "@/lib/notifications";

export async function cancelAppointment(slug: string, token: string): Promise<CancelResult> {
  if (typeof slug !== "string" || typeof token !== "string" || token.length > 64) {
    return { ok: false, message: "Turno inválido." };
  }
  const result = await cancelByToken(slug, token);
  if (result.ok) after(() => notifyAppointment("cancelled", token));
  return result;
}
