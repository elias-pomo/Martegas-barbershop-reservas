import { z } from "zod";

/**
 * Configuración por negocio. Se guarda como JSON en `Business.settings`.
 * Todo lo específico del rubro (textos, políticas) vive acá, nunca en el código.
 */
export const businessSettingsSchema = z.object({
  /** Cada cuántos minutos se ofrece un inicio de turno. */
  slotIntervalMin: z.number().int().min(5).default(60),
  /** Anticipación mínima para reservar online. */
  minLeadMin: z.number().int().min(0).default(15),
  /** Horas mínimas antes del turno para poder cancelar online. */
  cancelMinHours: z.number().min(0).default(5),
  /** Turnos regulares máximos por persona por semana. */
  maxPerWeek: z.number().int().min(1).default(2),
  /** Días de diferencia mínimos entre turnos de la misma semana. */
  minDaysBetween: z.number().int().min(0).default(2),
  /** Con esta cantidad de faltas, el cliente ya no puede reservar online. */
  noShowBlockThreshold: z.number().int().min(1).default(10),
  /** Día en que empieza la semana de reservas (0 = domingo). La semana siguiente se habilita a las 00:00 de ese día. */
  weekStartsOn: z.number().int().min(0).max(6).default(0),
  /** Recargo de referencia por persona para turnos especiales. */
  specialSurchargePerPerson: z.number().int().min(0).default(3000),
  /** Código de área por defecto para teléfonos cargados sin característica. */
  defaultAreaCode: z.string().regex(/^\d{2,4}$/).optional(),
  labels: z
    .object({
      staff: z.string().default("barbero"),
      service: z.string().default("servicio"),
    })
    .default({ staff: "barbero", service: "servicio" }),
  /** Plantillas de WhatsApp del panel. Cada una tiene su default, así se pueden agregar nuevas sin migrar datos. */
  waTemplates: z
    .object({
      reminder: z
        .string()
        .default("Hola {nombre}! Te recuerdo tu turno de {servicio} {cuando} a las {hora} en {negocio}, {direccion}. ¡Te espero!"),
      businessCancel: z
        .string()
        .default("Hola {nombre}, tuve un imprevisto y tengo que cancelar tu turno del {dia} a las {hora}. Podés reservar otro en {link}. ¡Disculpá!"),
      confirmation: z
        .string()
        .default("Hola {nombre}! Te confirmo tu turno {cuando} a las {hora} en {negocio}, {direccion}. Para verlo o cancelarlo: {link} (código {codigo})."),
      waitlistOffer: z
        .string()
        .default("Hola {nombre}! Se liberó un lugar el {dia} en {negocio}. Si lo querés, reservalo acá: {link} (es por orden de llegada)."),
      generic: z.string().default("Hola {nombre}! "),
    })
    // prefault (no default): en Zod 4 así se aplican los defaults internos cuando falta el objeto.
    .prefault({}),
});

export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

export function parseSettings(raw: unknown): BusinessSettings {
  return businessSettingsSchema.parse(raw ?? {});
}
