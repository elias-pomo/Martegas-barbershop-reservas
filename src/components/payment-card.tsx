"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function PaymentCard({ alias, holder }: { alias: string; holder: string | null }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(alias);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // portapapeles no disponible
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">Pagás en el local: efectivo o transferencia</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono font-semibold">{alias}</p>
          {holder && <p className="text-xs text-muted">{holder}</p>}
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition hover:bg-surface-2"
        >
          {copied ? <Check className="size-4 text-accent" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
