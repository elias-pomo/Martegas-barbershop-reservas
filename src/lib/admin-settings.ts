import "server-only";
import type { Admin } from "./auth";
import { db } from "./db";
import { normalizePhone } from "./domain/phone";
import { businessSettingsSchema, type BusinessSettings } from "./domain/settings";
import { hashPassword, verifyPassword } from "./password";
import { validatePassword } from "./admin-credentials";

type Business = Admin["business"];
export type SettingsResult = { ok: true } | { ok: false; message: string };

const mapsUrlFor = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** Lo que muestra la pantalla de Ajustes. */
export async function getSettingsData(business: Business) {
  const [services, staff] = await Promise.all([
    db.service.findMany({ where: { businessId: business.id }, orderBy: [{ active: "desc" }, { sortOrder: "asc" }] }),
    db.staff.findFirst({
      where: { businessId: business.id, active: true },
      orderBy: { name: "asc" },
      include: { workingHours: true },
    }),
  ]);
  return {
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, price: s.price, active: s.active })),
    hours: Array.from({ length: 7 }, (_, weekday) => {
      const block = staff?.workingHours.find((h) => h.weekday === weekday);
      return { weekday, open: !!block, firstStart: block?.firstStart ?? "15:00", lastStart: block?.lastStart ?? "22:00" };
    }),
  };
}

export async function updateBusinessInfo(
  business: Business,
  input: { name: string; address: string; whatsapp: string; instagram: string; paymentAlias: string; paymentHolder: string },
): Promise<SettingsResult> {
  let whatsapp: string | null = null;
  if (input.whatsapp.trim()) {
    whatsapp = normalizePhone(input.whatsapp, business.settings.defaultAreaCode);
    if (!whatsapp) return { ok: false, message: "El WhatsApp no es válido. Si es extranjero, empezalo con + y el código de país." };
  }
  const address = input.address.trim() || null;
  await db.business.update({
    where: { id: business.id },
    data: {
      name: input.name.trim(),
      address,
      mapsUrl: address ? mapsUrlFor(address) : null,
      whatsapp,
      instagram: input.instagram.trim() || null,
      paymentAlias: input.paymentAlias.trim() || null,
      paymentHolder: input.paymentHolder.trim() || null,
    },
  });
  return { ok: true };
}

export async function saveServices(
  business: Business,
  services: { id?: string; name: string; durationMin: number; price: number; active: boolean }[],
): Promise<SettingsResult> {
  if (!services.some((s) => s.active)) return { ok: false, message: "Tiene que quedar al menos un servicio activo." };

  const existingIds = new Set(
    (await db.service.findMany({ where: { businessId: business.id }, select: { id: true } })).map((s) => s.id),
  );
  if (services.some((s) => s.id && !existingIds.has(s.id))) return { ok: false, message: "Servicio inválido." };

  const staff = await db.staff.findMany({ where: { businessId: business.id }, select: { id: true } });

  await db.$transaction(async (tx) => {
    for (const [sortOrder, s] of services.entries()) {
      const data = { name: s.name.trim(), durationMin: s.durationMin, price: s.price, active: s.active, sortOrder };
      if (s.id) {
        await tx.service.update({ where: { id: s.id }, data });
      } else {
        // Los servicios nuevos los hacen todos los profesionales.
        await tx.service.create({
          data: { ...data, businessId: business.id, staff: { create: staff.map((st) => ({ staffId: st.id })) } },
        });
      }
    }
  });
  return { ok: true };
}

export async function saveWorkingHours(
  business: Business,
  hours: { weekday: number; open: boolean; firstStart: string; lastStart: string }[],
): Promise<SettingsResult> {
  const invalid = hours.find((h) => h.open && h.firstStart > h.lastStart);
  if (invalid) return { ok: false, message: "El primer turno no puede ser después del último." };

  const staff = await db.staff.findFirst({ where: { businessId: business.id, active: true }, orderBy: { name: "asc" } });
  if (!staff) return { ok: false, message: "No hay profesionales activos." };

  await db.$transaction([
    db.workingHours.deleteMany({ where: { staffId: staff.id } }),
    db.workingHours.createMany({
      data: hours
        .filter((h) => h.open)
        .map((h) => ({ staffId: staff.id, weekday: h.weekday, firstStart: h.firstStart, lastStart: h.lastStart })),
    }),
  ]);
  return { ok: true };
}

/** Mezcla cambios en `Business.settings` (políticas o plantillas) validando el resultado completo. */
export async function updateSettings(business: Business, patch: Partial<BusinessSettings>): Promise<SettingsResult> {
  const parsed = businessSettingsSchema.safeParse({ ...business.settings, ...patch });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Valores inválidos." };
  await db.business.update({ where: { id: business.id }, data: { settings: parsed.data } });
  return { ok: true };
}

/** Cambio de contraseña desde el panel. Devuelve la nueva versión de sesión para re-emitir la cookie. */
export async function changeOwnPassword(
  userId: string,
  current: string,
  next: string,
): Promise<{ ok: true; version: number } | { ok: false; message: string }> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    return { ok: false, message: "La contraseña actual no es correcta." };
  }
  const problem = validatePassword(next);
  if (problem) return { ok: false, message: problem };

  const updated = await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(next), sessionVersion: { increment: 1 } },
  });
  return { ok: true, version: updated.sessionVersion };
}
