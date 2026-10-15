import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDayAgenda, getWeekCounts, persistAttended } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { localDateOf } from "@/lib/domain/time";
import { getWaitlistForDay } from "@/lib/waitlist";
import { AgendaView } from "../agenda-view";
import type { AgendaData } from "../types";

export const metadata: Metadata = { title: "Agenda", robots: { index: false } };

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <Suspense fallback={<AgendaSkeleton />}>
        <Agenda searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Agenda({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  await connection();
  const [{ business }, query] = await Promise.all([requireAdmin(), searchParams]);
  const now = new Date();
  const today = localDateOf(now, business.timezone);
  const day = typeof query.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.dia) ? query.dia : today;

  await persistAttended(business.id, now);
  const [entries, week, services, waitlist] = await Promise.all([
    getDayAgenda(business, day, now),
    getWeekCounts(business, day),
    db.service.findMany({ where: { businessId: business.id, active: true }, orderBy: { sortOrder: "asc" } }),
    day >= today ? getWaitlistForDay(business, day) : [],
  ]);

  const data: AgendaData = {
    now: now.toISOString(),
    day,
    today,
    week,
    waitlist,
    business: {
      slug: business.slug,
      name: business.name,
      address: business.address,
      timeZone: business.timezone,
      templates: business.settings.waTemplates,
      specialSurchargePerPerson: business.settings.specialSurchargePerPerson,
      services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, price: s.price })),
    },
    entries: entries.map((e) =>
      e.kind === "free"
        ? { kind: "free", start: e.start.toISOString() }
        : e.kind === "block"
          ? {
              kind: "block",
              start: e.start.toISOString(),
              item: { ...e.item, start: e.item.start.toISOString(), end: e.item.end.toISOString() },
            }
          : {
              kind: "appointment",
              start: e.start.toISOString(),
              item: {
                ...e.item,
                start: e.item.start.toISOString(),
                end: e.item.end.toISOString(),
                reminderSentAt: e.item.reminderSentAt?.toISOString() ?? null,
              },
            },
    ),
  };

  return <AgendaView data={data} />;
}

function AgendaSkeleton() {
  return (
    <div className="barber-skeleton">
      <div className="h-10 w-40 rounded-lg bg-surface" />
      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-16 rounded-xl bg-surface" />
        ))}
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="mt-3 h-20 rounded-2xl bg-surface" />
      ))}
    </div>
  );
}
