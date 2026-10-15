const priceFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** 12000 → "$ 12.000" */
export function formatPrice(amount: number): string {
  return priceFormatter.format(amount);
}

/** 90 → "1 h 30 min" */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ");
}

/** Instante → "18:00" en la zona del negocio. */
export function formatTime(iso: string | Date, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Instante → "lunes 12 de octubre" en la zona del negocio. */
export function formatLongDate(iso: string | Date, timeZone: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Fecha local `YYYY-MM-DD` → { weekday: "lun", day: "12" } */
export function dayChipParts(date: string): { weekday: string; day: string } {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "short" }).replace(".", ""),
    day: String(d.getUTCDate()),
  };
}
