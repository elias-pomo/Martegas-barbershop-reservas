"use client";

import { CalendarPlus } from "lucide-react";
import { useSyncExternalStore } from "react";
import { appointmentEvent, icsUrl } from "@/lib/appointment-calendar";
import { googleCalendarUrl } from "@/lib/domain/calendar";

const noopSubscribe = () => () => {};

interface Props {
  token: string;
  slug: string;
  businessName: string;
  address: string | null;
  serviceName: string;
  startsAt: string;
  endsAt: string;
}

/** "Agregar a calendario": .ics (iPhone y la mayoría de apps, con alarmas) + Google Calendar. */
export function CalendarButtons(props: Props) {
  // El origin solo existe en el navegador; en el servidor el link de Google queda sin armar.
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
  const google = origin ? googleCalendarUrl(appointmentEvent({ ...props, origin })) : undefined;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">Agendalo y tu celular te avisa 1 día y 2 horas antes</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={icsUrl(props.slug, props.token)}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-surface-2 font-medium transition hover:bg-border active:scale-[0.98]"
        >
          <CalendarPlus className="size-4 text-primary" aria-hidden />
          Calendario
        </a>
        <a
          href={google}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-surface-2 font-medium transition hover:bg-border active:scale-[0.98]"
        >
          <CalendarPlus className="size-4 text-accent" aria-hidden />
          Google
        </a>
      </div>
    </div>
  );
}
