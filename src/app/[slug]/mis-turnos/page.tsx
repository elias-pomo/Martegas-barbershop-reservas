import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getBusinessBySlug } from "@/lib/business";
import { MyAppointments } from "./my-appointments";

export const metadata: Metadata = { title: "Mis turnos" };

export default function MisTurnosPage({ params }: PageProps<"/[slug]/mis-turnos">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Suspense fallback={<div className="mt-16 h-40 barber-skeleton rounded-2xl bg-surface" />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/[slug]/mis-turnos">["params"] }) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();
  return <MyAppointments slug={slug} timeZone={business.timezone} />;
}
