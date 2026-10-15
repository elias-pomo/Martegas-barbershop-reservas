const priceFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** 12000 → "$ 12.000" */
export function formatPrice(amount: number): string {
  return priceFormatter.format(amount);
}
