"use client";

import { ChevronRight, Search, UserX } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { formatPhone } from "@/lib/domain/phone";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  stats: { attended: number; noShows: number; cancelled: number; upcoming: number };
  lastAppointment: string | null;
  createdAt: string;
}

type Sort = "recent" | "visits" | "noShows" | "name";

const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Recientes" },
  { value: "visits", label: "Más visitas" },
  { value: "noShows", label: "Más faltas" },
  { value: "name", label: "A-Z" },
];

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function CustomerList({ customers, threshold }: { customers: CustomerRow[]; threshold: number }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const deferredQuery = useDeferredValue(query);

  const rows = useMemo(() => {
    const q = normalize(deferredQuery.trim());
    const digits = deferredQuery.replace(/\D/g, "");
    const filtered = customers.filter(
      (c) => !q || normalize(c.name).includes(q) || (digits.length >= 3 && c.phone.includes(digits)),
    );
    const by: Record<Sort, (a: CustomerRow, b: CustomerRow) => number> = {
      recent: (a, b) => (b.lastAppointment ?? b.createdAt).localeCompare(a.lastAppointment ?? a.createdAt),
      visits: (a, b) => b.stats.attended - a.stats.attended,
      noShows: (a, b) => b.stats.noShows - a.stats.noShows,
      name: (a, b) => a.name.localeCompare(b.name, "es"),
    };
    return [...filtered].sort(by[sort]);
  }, [customers, deferredQuery, sort]);

  const totals = useMemo(
    () => ({
      customers: customers.length,
      visits: customers.reduce((n, c) => n + c.stats.attended, 0),
    }),
    [customers],
  );

  return (
    <>
      <p className="mt-1 text-sm text-muted">
        {totals.customers} {totals.customers === 1 ? "cliente" : "clientes"} · {totals.visits} visitas
      </p>

      <label className="relative mt-4 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          placeholder="Buscar por nombre o teléfono"
          aria-label="Buscar cliente"
          className="h-12 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="radiogroup" aria-label="Ordenar">
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={sort === s.value}
            onClick={() => setSort(s.value)}
            className={`h-9 shrink-0 rounded-full border px-3 text-sm transition ${
              sort === s.value ? "border-primary bg-primary/15 text-primary" : "border-border text-muted"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">
          {customers.length === 0 ? "Todavía no hay clientes. Aparecen solos cuando reservan." : "Sin resultados."}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((c) => {
            const blocked = c.stats.noShows >= threshold;
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/clientes/${c.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:border-primary/60 active:scale-[0.99]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
                    {c.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="text-xs text-muted">{formatPhone(c.phone)}</span>
                  </span>
                  <span className="flex shrink-0 gap-1.5 text-xs">
                    <Stat value={c.stats.attended} label="visitas" className="bg-accent/15 text-accent" />
                    <Stat
                      value={c.stats.noShows}
                      label="faltas"
                      className={blocked ? "bg-danger text-white" : c.stats.noShows ? "bg-danger/15 text-danger" : "bg-surface-2 text-muted"}
                      icon={blocked}
                    />
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Stat({ value, label, className, icon }: { value: number; label: string; className: string; icon?: boolean }) {
  return (
    <span className={`flex min-w-11 flex-col items-center rounded-lg px-1.5 py-1 ${className}`} aria-label={`${value} ${label}`}>
      <span className="flex items-center gap-0.5 font-semibold leading-none">
        {icon && <UserX className="size-3" aria-hidden />}
        {value}
      </span>
      <span className="text-[9px] leading-tight opacity-80">{label}</span>
    </span>
  );
}
