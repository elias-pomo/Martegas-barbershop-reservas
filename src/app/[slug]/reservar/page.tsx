import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getBusinessBySlug } from "@/lib/business";
import { BookingFlow, type BookingBusiness } from "./booking-flow";

export const metadata: Metadata = { title: "Reservar turno" };

export default function ReservarPage({ params, searchParams }: PageProps<"/[slug]/reservar">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Suspense fallback={<FlowSkeleton />}>
        <Flow params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Flow({
  params,
  searchParams,
}: Pick<PageProps<"/[slug]/reservar">, "params" | "searchParams">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  // ?hora=<ISO> viene de tocar un horario libre en la semana del inicio.
  const hora = typeof query.hora === "string" ? query.hora : null;
  const preferredStart = hora && !Number.isNaN(Date.parse(hora)) ? hora : null;

  const props: BookingBusiness = {
    slug: business.slug,
    name: business.name,
    address: business.address,
    timeZone: business.timezone,
    whatsapp: business.whatsapp,
    paymentAlias: business.paymentAlias,
    paymentHolder: business.paymentHolder,
    staffLabel: business.settings.labels.staff,
    services: business.services.map((s) => ({
      id: s.id,
      name: s.name,
      durationMin: s.durationMin,
      price: s.price,
    })),
  };
  return <BookingFlow business={props} preferredStart={preferredStart} />;
}

function FlowSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-10 w-24 rounded-xl bg-surface" />
      <div className="mt-8 h-8 w-2/3 rounded-lg bg-surface" />
      <div className="mt-6 h-24 rounded-2xl bg-surface" />
      <div className="mt-3 h-24 rounded-2xl bg-surface" />
    </div>
  );
}
