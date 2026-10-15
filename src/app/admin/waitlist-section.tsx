"use client";

import { Hourglass, MessageCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatPhone } from "@/lib/domain/phone";
import { waitlistOfferLink } from "@/lib/domain/messages";
import { updateWaitlist } from "./actions";
import type { AgendaBusiness, WaitlistItem } from "./types";
import { useMessageContext } from "./use-message-context";

/** Clientes esperando lugar en el día. "Ofrecer" abre WhatsApp y los marca como contactados. */
export function WaitlistSection({ business, items }: { business: AgendaBusiness; items: WaitlistItem[] }) {
  const router = useRouter();
  const ctx = useMessageContext(business);
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  if (items.length === 0) return null;

  const update = (id: string, status: "CONTACTED" | "CLOSED") =>
    startTransition(async () => {
      await updateWaitlist(id, status);
      router.refresh();
    });

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-primary/30 bg-primary/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Hourglass className="size-4 text-primary" aria-hidden />
        <span className="flex-1 text-sm font-semibold">Lista de espera ({items.length})</span>
        <span className="text-xs text-muted">{open ? "Ocultar" : "Ver"}</span>
      </button>
      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                <span className="text-xs text-muted">
                  {formatPhone(item.phone)}
                  {item.serviceName && ` · ${item.serviceName}`}
                  {item.status === "CONTACTED" && <span className="text-accent"> · contactado</span>}
                </span>
              </span>
              <a
                href={waitlistOfferLink(ctx, item)}
                target="_blank"
                rel="noreferrer"
                onClick={() => item.status === "WAITING" && update(item.id, "CONTACTED")}
                className="flex h-9 items-center gap-1 rounded-lg bg-accent/15 px-3 text-sm font-semibold text-accent"
              >
                <MessageCircle className="size-4" aria-hidden />
                Ofrecer
              </a>
              <button
                type="button"
                disabled={pending}
                onClick={() => update(item.id, "CLOSED")}
                aria-label={`Quitar a ${item.name} de la lista`}
                className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
