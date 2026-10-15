import { ArrowLeft, MessageCircle, Phone, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { persistAttended } from "@/lib/admin";
import { getCustomerDetail } from "@/lib/admin-customers";
import { requireAdmin } from "@/lib/auth";
import { formatPhone } from "@/lib/domain/phone";
import type { AppointmentStatus } from "@/lib/domain/rules";
import { renderTemplate, waLink } from "@/lib/domain/whatsapp";
import { formatLongDate, formatPrice, formatTime } from "@/lib/format";
import { RenameCustomer } from "./rename-customer";

export const metadata: Metadata = { title: "Cliente", robots: { index: false } };

export default function ClientePage({ params }: PageProps<"/admin/clientes/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      <Link
        href="/admin/clientes"
        aria-label="Volver a clientes"
        className="-ml-2 flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
      >
        <ArrowLeft className="size-5" />
      </Link>
      <Suspense fallback={<div className="mt-4 h-64 barber-skeleton rounded-2xl bg-surface" />}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}

const STATUS: Record<AppointmentStatus, { label: string; className: string }> = {
  CONFIRMED: { label: "Próximo", className: "text-primary" },
  ATTENDED: { label: "Asistió", className: "text-accent" },
  NO_SHOW: { label: "No vino", className: "text-danger" },
  LATE_CANCEL: { label: "Canceló tarde", className: "text-danger" },
  CANCELLED_BY_CUSTOMER: { label: "Canceló", className: "text-muted" },
  CANCELLED_BY_BUSINESS: { label: "Cancelado por vos", className: "text-muted" },
};

async function Detail({ params }: { params: PageProps<"/admin/clientes/[id]">["params"] }) {
  await connection();
  const [{ business }, { id }] = await Promise.all([requireAdmin(), params]);
  await persistAttended(business.id);
  const customer = await getCustomerDetail(business, id);
  if (!customer) notFound();

  const tz = business.timezone;
  const whatsapp = waLink(
    customer.phone,
    renderTemplate(business.settings.waTemplates.generic, { nombre: customer.name.split(" ")[0] }),
  );

  return (
    <>
      <div className="mt-2 flex items-center gap-3">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-2xl font-semibold text-primary">
          {customer.name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <RenameCustomer id={customer.id} name={customer.name} />
          <p className="text-sm text-muted">{formatPhone(customer.phone)}</p>
        </div>
      </div>

      {customer.blocked && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          <UserX className="size-4 shrink-0 text-danger" aria-hidden />
          Tiene {customer.stats.noShows} faltas: solo puede pedir turno por WhatsApp.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-accent-foreground active:scale-[0.98]"
        >
          <MessageCircle className="size-4" aria-hidden />
          WhatsApp
        </a>
        <a
          href={`tel:${customer.phone}`}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface font-medium active:scale-[0.98]"
        >
          <Phone className="size-4" aria-hidden />
          Llamar
        </a>
      </div>

      <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
        <Tile label="Visitas" value={customer.stats.attended} className="text-accent" />
        <Tile label="Faltas" value={customer.stats.noShows} className={customer.stats.noShows ? "text-danger" : ""} />
        <Tile label="Canceló" value={customer.stats.cancelled} />
        <Tile label="Próximos" value={customer.stats.upcoming} className="text-primary" />
      </dl>

      <h2 className="mt-6 font-display text-2xl tracking-wide">Historial</h2>
      {customer.appointments.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Sin turnos.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {customer.appointments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate first-letter:uppercase">
                  {formatLongDate(a.startsAt, tz)} · {formatTime(a.startsAt, tz)}
                </p>
                <p className="text-xs text-muted">
                  {a.serviceName} · {formatPrice(a.price)}
                </p>
              </div>
              <span className={`shrink-0 text-xs font-medium ${STATUS[a.status].className}`}>{STATUS[a.status].label}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-center text-xs text-muted">
        Cliente desde {customer.createdAt.toLocaleDateString("es-AR", { timeZone: tz, month: "long", year: "numeric" })}
      </p>
    </>
  );
}

function Tile({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface py-3">
      <dd className={`text-xl font-semibold ${className}`}>{value}</dd>
      <dt className="text-[11px] text-muted">{label}</dt>
    </div>
  );
}
