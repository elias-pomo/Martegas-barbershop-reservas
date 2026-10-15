import { jwtVerify, SignJWT } from "jose";

/** Token de sesión del panel. Sin dependencias de Next: lo usa también `proxy.ts`. */

export const SESSION_COOKIE = "agendapp_session";
export const SESSION_DAYS = 30;

export interface SessionPayload {
  userId: string;
  businessId: string;
}

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET falta o es demasiado corto (mínimo 32 caracteres).");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || typeof payload.businessId !== "string") return null;
    return { userId: payload.userId, businessId: payload.businessId };
  } catch {
    return null;
  }
}
