import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normaliza un teléfono a E.164. Los celulares argentinos quedan siempre como
 * `+549` + 10 dígitos (formato que usa WhatsApp), sin importar cómo los escriba
 * el cliente: `381 1234567`, `0381 15 1234567`, `+54 9 381 123-4567`…
 * Devuelve `null` si no es un número válido.
 */
export function normalizePhone(input: string, defaultAreaCode?: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (raw.startsWith("+") && !raw.replace(/\D/g, "").startsWith("54")) {
    const intl = parsePhoneNumberFromString(raw);
    return intl?.isValid() ? intl.number : null;
  }

  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("54")) digits = digits.slice(2);
  if (digits.startsWith("9") && digits.length === 11) digits = digits.slice(1);
  if (digits.startsWith("0")) digits = digits.slice(1);

  // Sin característica: "15 1234567" o "1234567" → se completa con el código de área del negocio.
  if (defaultAreaCode && digits.length <= 9) {
    if (digits.startsWith("15") && digits.length === 9) digits = digits.slice(2);
    if (digits.length === 10 - defaultAreaCode.length) digits = defaultAreaCode + digits;
  }

  // Quitar el "15" que va después de la característica (área de 2 a 4 dígitos).
  if (digits.length === 12) {
    for (const areaLen of [2, 3, 4]) {
      if (digits.slice(areaLen, areaLen + 2) === "15") {
        digits = digits.slice(0, areaLen) + digits.slice(areaLen + 2);
        break;
      }
    }
  }

  if (digits.length !== 10) return null;
  const parsed = parsePhoneNumberFromString(`+549${digits}`);
  return parsed?.isValid() ? parsed.number : null;
}

/**
 * Para mostrar. Celulares argentinos sin el 0 ni el 15: `+5493811234567` → `381 123-4567`.
 * Números de otros países, en formato internacional: `+34 641 31 12 13`.
 */
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  if (parsed.country !== "AR") return parsed.formatInternational();
  // formatNational da "0381 15-123-4567": se quitan el 0 de larga distancia y el 15 de celular.
  return parsed
    .formatNational()
    .replace(/^0/, "")
    .replace(/ 15-/, " ")
    .replace(/^(\d+) (\d+)-(\d+)-(\d+)$/, "$1 $2$3-$4");
}
