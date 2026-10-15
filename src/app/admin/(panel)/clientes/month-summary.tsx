import { TrendingDown, TrendingUp } from "lucide-react";
import type { MonthlySummary } from "@/lib/admin-customers";
import { formatPrice } from "@/lib/format";

const monthName = (month: string) =>
  new Date(`${month}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", month: "long" });

/** Variación porcentual contra el mes anterior; null si no hay base para comparar. */
function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function MonthSummary({ summary }: { summary: MonthlySummary }) {
  const { current, previous, pending } = summary;
  const cutsChange = change(current.cuts, previous.cuts);
  const revenueChange = change(current.revenue, previous.revenue);

  return (
    <section aria-labelledby="resumen-mes" className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
      <h2 id="resumen-mes" className="sr-only">
        Resumen del mes
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="px-4 pb-2 pt-3 font-medium">Mes</th>
            <th className="px-2 pb-2 pt-3 text-right font-medium">Cortes</th>
            <th className="px-4 pb-2 pt-3 text-right font-medium">Recaudado</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-primary/10">
            <th scope="row" className="px-4 py-3 text-left font-semibold first-letter:uppercase">
              {monthName(current.month)}
            </th>
            <td className="px-2 py-3 text-right">
              <span className="text-xl font-semibold">{current.cuts}</span>
              <Change value={cutsChange} />
            </td>
            <td className="px-4 py-3 text-right">
              <span className="text-xl font-semibold text-accent">{formatPrice(current.revenue)}</span>
              <Change value={revenueChange} />
            </td>
          </tr>
          <tr className="border-t border-border text-muted">
            <th scope="row" className="px-4 py-2.5 text-left font-normal first-letter:uppercase">
              {monthName(previous.month)}
            </th>
            <td className="px-2 py-2.5 text-right">{previous.cuts}</td>
            <td className="px-4 py-2.5 text-right">{formatPrice(previous.revenue)}</td>
          </tr>
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2.5 text-xs text-muted">
        {pending.cuts > 0 ? (
          <>
            Quedan <span className="font-semibold text-foreground">{pending.cuts}</span>{" "}
            {pending.cuts === 1 ? "corte confirmado" : "cortes confirmados"} este mes ·{" "}
            <span className="font-semibold text-foreground">+{formatPrice(pending.revenue)}</span>
          </>
        ) : (
          "No quedan turnos confirmados este mes."
        )}
        <span className="mt-0.5 block text-[10px]">Montos estimados según el precio de cada turno asistido.</span>
      </p>
    </section>
  );
}

function Change({ value }: { value: number | null }) {
  if (value === null || value === 0) return null;
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center justify-end gap-0.5 text-[11px] font-medium ${up ? "text-accent" : "text-danger"}`}>
      <Icon className="size-3" aria-hidden />
      {up ? "+" : ""}
      {value}% vs mes anterior
    </span>
  );
}
