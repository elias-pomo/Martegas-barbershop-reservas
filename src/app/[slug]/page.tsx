import { CalendarCheck, CalendarClock, Camera, MapPin, MessageCircle, Sparkles } from "lucide-react";
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
        <p className="text-xs uppercase tracking-[0.35em] text-muted">Turnos online</p>
        {/* Cartel de neón: primera palabra en morado, el resto en verde. Se prende una vez al abrir. */}
        <h1 className="neon-power-on mt-3 font-display text-6xl leading-[0.95] tracking-wide">
          <span className="neon-text-purple">{nameParts.first}</span>
          {nameParts.rest && (
            <>
              <br />
              <span className="neon-text-green">{nameParts.rest}</span>
            </>
          )}
        </h1>
        {business.address && business.mapsUrl && (
          <a
            href={business.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
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
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Servicios</h2>
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {business.services.map((service) => (
            <li key={service.id} className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="font-medium">{service.name}</p>
                <p className="text-sm text-muted">{formatDuration(service.durationMin)}</p>
              </div>
              <p className="font-semibold text-accent">{formatPrice(service.price)}</p>
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
    <div className="animate-pulse">
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
