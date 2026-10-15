/** Link `wa.me` con mensaje precargado. `phone` en E.164 (con o sin `+`). */
export function waLink(phone: string, text?: string): string {
  const base = `https://wa.me/${phone.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Reemplaza `{clave}` por su valor. Las claves desconocidas quedan como están. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}
