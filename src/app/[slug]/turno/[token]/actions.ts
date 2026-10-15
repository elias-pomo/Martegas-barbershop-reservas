"use server";

import { cancelByToken, type CancelResult } from "@/lib/appointments";

export async function cancelAppointment(slug: string, token: string): Promise<CancelResult> {
  if (typeof slug !== "string" || typeof token !== "string" || token.length > 64) {
    return { ok: false, message: "Turno inválido." };
  }
  return cancelByToken(slug, token);
}
