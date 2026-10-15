import { CalendarCheck, CalendarClock, Camera, ChevronRight, Clock, MapPin, MessageCircle, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getWeekOverview } from "@/lib/booking";
import { getBusinessBySlug } from "@/lib/business";
import { localDateOf } from "@/lib/domain/time";
import { waLink } from "@/lib/domain/whatsapp";
import { formatDuration, formatPrice } from "@/lib/format";
import { ServiceIcon } from "@/components/service-icon";
import { OpenBadge, OpenBadgeSkeleton } from "./open-badge";
import { WeekView, WeekViewSkeleton } from "./week-view";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const business = await getBusinessBySlug((await params).slug);
  return { title: business?.name ?? "Negocio no encontrado" };
}

export default function BusinessPage({ params }: PageProps<"/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <Suspense fallback={<HomeSkeleton />}>
        <BusinessHome params={params} />
      </Suspense>
    </main>
  );
}

async function BusinessHome({ params }: { params: PageProps<"/[slug]">["params"] }) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  const [first, ...rest] = business.name.trim().split(/\s+/);
  const nameParts = { first, rest: rest.join(" ") };

  return (
    <>
      <header className="text-center">
        {/* Cartel de neón: primera palabra en morado, el resto en verde. Se prende una vez al abrir. */}
        <h1 className="neon-power-on font-display text-6xl leading-[0.95] tracking-wide">
          <span className="neon-text-purple">{nameParts.first}</span>
          {nameParts.rest && (
            <>
              <br />
              <span className="neon-text-green">{nameParts.rest}</span>
            </>
          )}
        </h1>
        <div>
          <Suspense fallback={<OpenBadgeSkeleton />}>
            <OpenBadge slug={slug} />
          </Suspense>
        </div>
        {business.address && business.mapsUrl && (
          <a
            href={business.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
          >
            <MapPin className="size-4" aria-hidden />
            {business.address}
          </a>
        )}
        <div className="neon-line mx-auto mt-6 w-2/3" aria-hidden />
      </header>

      <nav className="mt-10 flex flex-col gap-3">
        <Link
          href={`/${slug}/reservar`}
          className="btn-neon flex h-16 items-center justify-center gap-2 rounded-2xl text-lg font-semibold"
        >
          <CalendarCheck className="size-5" aria-hidden />
          Reservar turno
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <SecondaryLink href={`/${slug}/mis-turnos`} icon={<CalendarClock className="size-5" />}>
            Mis turnos
          </SecondaryLink>
          <SecondaryLink href={`/${slug}/especial`} icon={<Sparkles className="size-5" />}>
            Turno especial
          </SecondaryLink>
        </div>
      </nav>

      {/* La semana depende de la hora actual: se transmite aparte para no frenar el resto. */}
      <Suspense fallback={<WeekViewSkeleton />}>
        <WeekSection slug={slug} />
      </Suspense>

      <section className="mt-10">
        <h2 className="font-display text-3xl tracking-wide">Servicios</h2>
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {business.services.map((service, i, all) => (
            // Con cantidad impar, la última tarjeta ocupa las dos columnas.
            <li key={service.id} className={all.length % 2 === 1 && i === all.length - 1 ? "col-span-2" : ""}>
              <ServiceCard slug={slug} service={service} />
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto flex justify-center gap-6 pt-10 text-sm text-muted">
        {business.whatsapp && (
          <a href={waLink(business.whatsapp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <MessageCircle className="size-4" aria-hidden />
            WhatsApp
          </a>
        )}
        {business.instagram && (
          <a href={business.instagram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <Camera className="size-4" aria-hidden />
            Instagram
          </a>
        )}
      </footer>
    </>
  );
}

async function WeekSection({ slug }: { slug: string }) {
  await connection();
  const now = new Date();
  const overview = await getWeekOverview(slug, now);
  if (!overview) return null;

  return (
    <WeekView
      slug={slug}
      timeZone={overview.timeZone}
      today={localDateOf(now, overview.timeZone)}
      days={overview.days.map((d) => ({
        date: d.date,
        open: d.open,
        slots: d.slots.map((s) => ({ start: s.start.toISOString(), state: s.state })),
      }))}
    />
  );
}

/** Tarjeta de servicio: tocarla abre la reserva con ese servicio ya elegido. */
function ServiceCard({
  slug,
  service,
}: {
  slug: string;
  service: { id: string; name: string; description: string | null; durationMin: number; price: number };
}) {
  return (
    <Link
      href={`/${slug}/reservar?servicio=${service.id}`}
      className="btn-glass group relative flex h-full flex-col overflow-hidden rounded-2xl p-4"
    >
      {/* Filo de luz arriba: el único adorno de la tarjeta. */}
      <span
        className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[var(--neon-purple)] to-transparent opacity-70 transition group-hover:opacity-100"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-[var(--neon-purple)] transition group-hover:shadow-[0_0_14px_rgb(139_92_246_/_0.45)]">
          <ServiceIcon name={service.name} className="size-7" />
        </span>
        <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
          <Clock className="size-3" aria-hidden />
          {formatDuration(service.durationMin)}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-tight">{service.name}</h3>
      {service.description && <p className="mt-1 line-clamp-4 text-sm leading-snug text-muted">{service.description}</p>}
      <div className="mt-auto flex items-end justify-between pt-4">
        <span className="text-xl font-semibold text-accent [text-shadow:0_0_10px_rgb(34_197_94_/_0.45)]">
          {formatPrice(service.price)}
        </span>
        <ChevronRight className="size-5 text-muted transition group-hover:translate-x-0.5 group-hover:text-[var(--neon-purple)]" aria-hidden />
      </div>
    </Link>
  );
}

function SecondaryLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="btn-glass flex h-14 items-center justify-center gap-2 rounded-2xl font-medium"
    >
      <span aria-hidden className="text-[var(--neon-purple)] drop-shadow-[0_0_6px_rgb(139_92_246_/_0.8)]">{icon}</span>
      {children}
    </Link>
  );
}

function HomeSkeleton() {
  return (
    <div className="barber-skeleton">
      <div className="mx-auto mt-6 h-14 w-4/5 rounded-xl bg-surface" />
      <div className="mt-10 h-16 rounded-2xl bg-surface" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="h-14 rounded-2xl bg-surface" />
        <div className="h-14 rounded-2xl bg-surface" />
      </div>
      <div className="mt-10 h-36 rounded-2xl bg-surface" />
    </div>
  );
}
