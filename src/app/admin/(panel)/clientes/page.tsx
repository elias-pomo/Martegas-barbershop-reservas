import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { persistAttended } from "@/lib/admin";
import { getMonthlySummary, listCustomers } from "@/lib/admin-customers";
import { requireAdmin } from "@/lib/auth";
import { CustomerList } from "./customer-list";
import { MonthSummary } from "./month-summary";

export const metadata: Metadata = { title: "Clientes", robots: { index: false } };

export default function ClientesPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
      <Suspense fallback={<ListSkeleton />}>
        <Customers />
      </Suspense>
    </main>
  );
}

async function Customers() {
  await connection();
  const { business } = await requireAdmin();
  await persistAttended(business.id);
  const [customers, summary] = await Promise.all([listCustomers(business), getMonthlySummary(business)]);

  return (
    <>
      <MonthSummary summary={summary} />
      <CustomerList
        threshold={business.settings.noShowBlockThreshold}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          stats: c.stats,
          lastAppointment: c.lastAppointment?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-4 animate-pulse">
      <div className="mb-4 h-36 rounded-2xl bg-surface" />
      <div className="h-12 rounded-xl bg-surface" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="mt-2 h-16 rounded-2xl bg-surface" />
      ))}
    </div>
  );
}
