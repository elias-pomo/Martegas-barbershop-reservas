import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getBusinessBySlug } from "@/lib/business";
import { SpecialRequestForm } from "./special-form";

export const metadata: Metadata = { title: "Turno especial" };

export default function EspecialPage({ params }: PageProps<"/[slug]/especial">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Suspense fallback={<div className="mt-16 h-64 barber-skeleton rounded-2xl bg-surface" />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/[slug]/especial">["params"] }) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business?.whatsapp) notFound();

  return (
    <SpecialRequestForm
      slug={slug}
      businessName={business.name}
      whatsapp={business.whatsapp}
      surchargePerPerson={business.settings.specialSurchargePerPerson}
    />
  );
}
