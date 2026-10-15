"use client";

import { Check, CheckCheck, MessageCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { reminderLink } from "@/lib/domain/messages";
import { formatTime } from "@/lib/format";
import { reminderSent } from "./actions";
import { Sheet } from "./sheet";
import type { AgendaAppointment, AgendaBusiness } from "./types";
import { useMessageContext } from "./use-message-context";

/**
 * Todos los recordatorios del día en un lugar: un botón grande manda al siguiente
 * pendiente (abre WhatsApp con el mensaje listo) y avanza solo.
 */
export function RemindersSheet({
  open,
  onClose,
  business,
  appointments,
}: {
  open: boolean;
  onClose: () => void;
  business: AgendaBusiness;
  appointments: AgendaAppointment[];
}) {
  const router = useRouter();
  const ctx = useMessageContext(business);
  // Marcados en esta sesión: la UI avanza al instante sin esperar al servidor.
  const [sentNow, setSentNow] = useState<Set<string>>(new Set());

  const isSent = (a: AgendaAppointment) => !!a.reminderSentAt || sentNow.has(a.id);
  const next = appointments.find((a) => !isSent(a));
  const done = appointments.filter(isSent).length;

  const linkFor = (a: AgendaAppointment) =>
    reminderLink(ctx, { customerName: a.customer.name, phone: a.customer.phone, serviceName: a.serviceName, startsAt: a.start, token: a.token });

  const markSent = (a: AgendaAppointment) => {
    setSentNow((s) => new Set(s).add(a.id));
    reminderSent(a.id).then(() => router.refresh());
  };

  return (
    <Sheet open={open} onClose={onClose} title="Recordatorios del día">
      <p className="text-sm text-muted">
        {done} de {appointments.length} enviados
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${appointments.length ? (done / appointments.length) * 100 : 0}%` }}
        />
      </div>

      {next ? (
        <a
          href={linkFor(next)}
          target="_blank"
          rel="noreferrer"
          onClick={() => markSent(next)}
          className="mt-4 flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-semibold text-accent-foreground active:scale-[0.98]"
        >
          <Send className="size-5 shrink-0" aria-hidden />
          <span className="truncate">
            Enviar a {next.customer.name.split(" ")[0]} · {formatTime(next.start, business.timeZone)}
          </span>
        </a>
      ) : (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-accent/15 py-4 font-semibold text-accent">
          <CheckCheck className="size-5" aria-hidden />
          ¡Listo, todos avisados!
        </p>
      )}

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {appointments.map((a) => {
          const sent = isSent(a);
          return (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-12 shrink-0 font-semibold text-primary">{formatTime(a.start, business.timeZone)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.customer.name}</span>
                <span className="text-xs text-muted">{a.serviceName}</span>
              </span>
              <a
                href={linkFor(a)}
                target="_blank"
                rel="noreferrer"
                onClick={() => markSent(a)}
                aria-label={sent ? `Reenviar a ${a.customer.name}` : `Enviar a ${a.customer.name}`}
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${sent ? "bg-surface-2 text-accent" : "bg-accent/15 text-accent"}`}
              >
                {sent ? <Check className="size-4" /> : <MessageCircle className="size-4" />}
              </a>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
