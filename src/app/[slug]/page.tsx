import { CalendarCheck, CalendarClock, Camera, MapPin, MessageCircle, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getBusinessBySlug } from "@/lib/business";
import { waLink } from "@/lib/domain/whatsapp";
import { formatDuration, formatPrice } from "@/lib/format";

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

  return (
    <>
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-muted">Turnos online</p>
        <h1 className="mt-2 font-display text-6xl leading-none tracking-wide">
          <span className="bg-gradient-to-r from-primary via-fuchsia-400 to-accent bg-clip-text text-transparent">
            {business.name}
          </span>
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
      </header>

      <nav className="mt-10 flex flex-col gap-3">
        <Link
          href={`/${slug}/reservar`}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[0.98] hover:bg-primary-strong"
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

function SecondaryLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-border bg-surface font-medium transition active:scale-[0.98] hover:bg-surface-2"
    >
      <span aria-hidden className="text-primary">{icon}</span>
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
