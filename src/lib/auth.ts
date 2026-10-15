import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { parseSettings } from "./domain/settings";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession, type SessionPayload } from "./session-token";

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Capa de acceso a datos del panel: toda página o acción del admin pasa por acá.
 * `proxy.ts` solo hace un chequeo optimista; la verificación real es esta.
 */
export async function requireAdmin() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/salir");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { business: true },
  });
  // Sesión firmada pero vencida para el usuario (credenciales cambiadas, usuario borrado): se limpia la cookie.
  if (!user || user.businessId !== session.businessId || user.sessionVersion !== session.version) {
    redirect("/admin/salir");
  }

  const { business } = user;
  return {
    userId: user.id,
    email: user.email,
    business: { ...business, settings: parseSettings(business.settings) },
  };
}

export type Admin = Awaited<ReturnType<typeof requireAdmin>>;
