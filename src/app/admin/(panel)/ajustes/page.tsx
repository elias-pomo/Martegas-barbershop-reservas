import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getSettingsData } from "@/lib/admin-settings";
import { requireAdmin } from "@/lib/auth";
import { vapidPublicKey } from "@/lib/push";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Ajustes", robots: { index: false } };

export default function AjustesPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
      <Suspense fallback={<div className="mt-4 h-96 animate-pulse rounded-2xl bg-surface" />}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  await connection();
  const { business, email } = await requireAdmin();
  const { services, hours } = await getSettingsData(business);
  const s = business.settings;

  return (
    <SettingsView
      email={email}
      vapidKey={vapidPublicKey()}
      slug={business.slug}
      info={{
        name: business.name,
        address: business.address ?? "",
        whatsapp: business.whatsapp ?? "",
        instagram: business.instagram ?? "",
        paymentAlias: business.paymentAlias ?? "",
        paymentHolder: business.paymentHolder ?? "",
      }}
      services={services}
      hours={hours}
      policies={{
        slotIntervalMin: s.slotIntervalMin,
        minLeadMin: s.minLeadMin,
        cancelMinHours: s.cancelMinHours,
        maxPerWeek: s.maxPerWeek,
        minDaysBetween: s.minDaysBetween,
        noShowBlockThreshold: s.noShowBlockThreshold,
        specialSurchargePerPerson: s.specialSurchargePerPerson,
      }}
      templates={s.waTemplates}
    />
  );
}
