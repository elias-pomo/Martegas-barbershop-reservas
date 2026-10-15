import { ArrowLeft, CalendarCheck, CalendarX2, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarButtons } from "@/components/calendar-buttons";
import { PaymentCard } from "@/components/payment-card";
import { getAppointmentByToken } from "@/lib/appointments";
import type { AppointmentStatus } from "@/lib/domain/rules";
import { renderTemplate, waLink } from "@/lib/domain/whatsapp";
import { formatLongDate, formatPrice, formatTime } from "@/lib/format";
import { CancelSection } from "./cancel-section";

export const metadata: Metadata = { title: "Mi turno", robots: { index: false } };

export default function TurnoPage({ params }: PageProps<"/[slug]/turno/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Suspense fallback={<div className="mt-16 h-64 animate-pulse rounded-2xl bg-surface" />}>
        <TurnoDetail params={params} />
      </Suspense>
    </main>
  );
}

const STATUS_LABEL: Record<AppointmentStatus, { text: string; tone: "ok" | "muted" | "bad" }> = {
  CONFIRMED: { text: "Confirmado", tone: "ok" },
  ATTENDED: { text: "Realizado", tone: "muted" },
  NO_SHOW: { text: "No asististe", tone: "bad" },
  LATE_CANCEL: { text: "Cancelado tarde", tone: "bad" },
  CANCELLED_BY_CUSTOMER: { text: "Cancelado", tone: "bad" },
  CANCELLED_BY_BUSINESS: { text: "Cancelado por el negocio", tone: "bad" },
};

const TONE = {
  ok: "bg-accent/15 text-accent",
  muted: "bg-surface-2 text-muted",
  bad: "bg-danger/15 text-danger",
};

async function TurnoDetail({ params }: { params: PageProps<"/[slug]/turno/[token]">["params"] }) {
  await connection(); // el estado depende de la hora actual
  const { slug, token } = await params;
  const found = await getAppointmentByToken(slug, token);
  if (!found) notFound();

  const { business, appointment } = found;
  const tz = business.timezone;
  const label = STATUS_LABEL[appointment.status];
  const time = formatTime(appointment.startsAt, tz);
  const day = formatLongDate(appointment.startsAt, tz);
  const cancelled = appointment.status.startsWith("CANCELLED") || appointment.status === "LATE_CANCEL";

  const whatsappHref = business.whatsapp
    ? waLink(
        business.whatsapp,
        renderTemplate("Hola! Soy {nombre}, tengo turno el {dia} a las {hora} y no voy a poder ir.", {
          nombre: appointment.customerName,
          dia: day,
          hora: time,
        }),
      )
    : null;

  return (
    <>
      <Link
        href={`/${slug}`}
        className="-ml-2 flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
        aria-label="Volver al inicio"
      >
        <ArrowLeft className="size-5" />
      </Link>

      <section className="mt-4 overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="bg-gradient-to-br from-primary/25 via-primary/5 to-transparent p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{business.name}</p>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TONE[label.tone]}`}>{label.text}</span>
          </div>
          <p className={`mt-4 text-5xl font-semibold tracking-tight ${cancelled ? "text-muted line-through" : ""}`}>
            {time}
          </p>
          <p className="mt-1 text-lg first-letter:uppercase">{day}</p>
        </div>
        <dl className="divide-y divide-border border-t border-border text-sm">
          <Row label="Servicio" value={appointment.serviceName} />
          <Row label="Precio" value={formatPrice(appointment.price)} />
          <Row label="A nombre de" value={appointment.customerName} />
        </dl>
        {business.address && (
          <a
            href={business.mapsUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 border-t border-border px-5 py-4 text-sm text-muted hover:text-foreground"
          >
            <MapPin className="size-4 text-primary" aria-hidden />
            {business.address}
          </a>
        )}
      </section>

      {appointment.isUpcoming ? (
        <div className="mt-4 flex flex-col gap-3">
          <CalendarButtons
            token={appointment.token}
            slug={slug}
            businessName={business.name}
            address={business.address}
            serviceName={appointment.serviceName}
            startsAt={appointment.startsAt.toISOString()}
            endsAt={appointment.endsAt.toISOString()}
          />
          {business.paymentAlias && <PaymentCard alias={business.paymentAlias} holder={business.paymentHolder} />}
          <div className="mt-4">
            <CancelSection
              slug={slug}
              token={appointment.token}
              canCancel={appointment.canCancel}
              cancelMinHours={business.settings.cancelMinHours}
              whatsappHref={whatsappHref}
            />
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center text-center">
          {cancelled ? (
            <CalendarX2 className="size-8 text-muted" aria-hidden />
          ) : (
            <CalendarCheck className="size-8 text-muted" aria-hidden />
          )}
          <p className="mt-2 text-muted">{cancelled ? "Este turno fue cancelado." : "Este turno ya pasó."}</p>
          <Link
            href={`/${slug}/reservar`}
            className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-primary font-semibold text-primary-foreground transition hover:bg-primary-strong active:scale-[0.98]"
          >
            Reservar otro turno
          </Link>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-5 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
