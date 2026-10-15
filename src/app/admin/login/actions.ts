"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, deleteSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { clearLoginFailures, isLoginLocked, LOGIN_LIMITS, recordLoginFailure } from "@/lib/login-throttle";
import { verifyPassword } from "@/lib/password";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export type LoginState = { error: string; email: string } | null;

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Ingresá tu email y contraseña.", email };

  const ip = await clientIp();
  if (await isLoginLocked(parsed.data.email, ip)) {
    return {
      error: `Demasiados intentos fallidos. Esperá ${LOGIN_LIMITS.windowMin} minutos y volvé a probar.`,
      email,
    };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !valid) {
    await recordLoginFailure(parsed.data.email, ip);
    // Demora fija para frenar intentos repetidos.
    await new Promise((r) => setTimeout(r, 800));
    return { error: "Email o contraseña incorrectos.", email };
  }

  await clearLoginFailures(parsed.data.email);
  await createSession({ userId: user.id, businessId: user.businessId, version: user.sessionVersion });
  redirect("/admin");
}

export async function logout() {
  await deleteSession();
  redirect("/admin/login");
}
