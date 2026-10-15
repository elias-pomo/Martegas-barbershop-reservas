import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "./password";

export const MIN_PASSWORD_LENGTH = 10;

const emailSchema = z.string().trim().toLowerCase().email("El email no es válido.");

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "La contraseña tiene que combinar letras y números.";
  return null;
}

export type CredentialsResult = { ok: true; email: string } | { ok: false; message: string };

/**
 * Cambia el email y/o la contraseña del dueño de un negocio y cierra todas sus sesiones.
 * Recibe el cliente de Prisma para poder usarse desde scripts (fuera de Next) y tests.
 */
export async function updateOwnerCredentials(
  db: PrismaClient,
  params: { slug: string; email?: string; password?: string },
): Promise<CredentialsResult> {
  if (!params.email && !params.password) return { ok: false, message: "No hay nada para cambiar." };

  const owner = await db.user.findFirst({
    where: { role: "OWNER", business: { slug: params.slug } },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) return { ok: false, message: `No existe un dueño para el negocio "${params.slug}".` };

  let email: string | undefined;
  if (params.email) {
    const parsed = emailSchema.safeParse(params.email);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
    email = parsed.data;
    const taken = await db.user.findFirst({ where: { email, id: { not: owner.id } } });
    if (taken) return { ok: false, message: "Ese email ya lo usa otro usuario." };
  }

  if (params.password) {
    const problem = validatePassword(params.password);
    if (problem) return { ok: false, message: problem };
  }

  const updated = await db.user.update({
    where: { id: owner.id },
    data: {
      ...(email && { email }),
      ...(params.password && { passwordHash: await hashPassword(params.password) }),
      sessionVersion: { increment: 1 },
    },
  });
  return { ok: true, email: updated.email };
}
