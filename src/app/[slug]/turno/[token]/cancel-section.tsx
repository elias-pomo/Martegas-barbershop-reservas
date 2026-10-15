"use client";

import { AnimatePresence, motion } from "motion/react";
import { Loader2, MessageCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeSavedAppointment } from "@/lib/saved-appointments";
import { cancelAppointment } from "./actions";

interface Props {
  slug: string;
  token: string;
  canCancel: boolean;
  cancelMinHours: number;
  whatsappHref: string | null;
}

export function CancelSection({ slug, token, canCancel, cancelMinHours, whatsappHref }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canCancel) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-center">
        <p className="text-sm text-muted">
          Faltan menos de {cancelMinHours} horas. Si no podés venir, avisale por WhatsApp así puede darle el turno a otra persona.
        </p>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-accent-foreground transition active:scale-[0.98]"
          >
            <MessageCircle className="size-5" aria-hidden />
            Avisar por WhatsApp
          </a>
        )}
      </div>
    );
  }

  const cancel = () => {
    setError(null);
    startTransition(async () => {
      const result = await cancelAppointment(slug, token);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      removeSavedAppointment(slug, token);
      router.refresh();
    });
  };

  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        {confirming ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-danger/40 bg-danger/10 p-4"
          >
            <p className="text-center font-medium">¿Seguro que querés cancelar el turno?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="h-12 rounded-xl border border-border bg-surface font-medium"
              >
                No, volver
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={pending}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-danger font-semibold text-white disabled:opacity-70"
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Sí, cancelar
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="ask"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirming(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-danger transition hover:bg-danger/10"
          >
            <X className="size-4" aria-hidden />
            Cancelar turno
          </motion.button>
        )}
      </AnimatePresence>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm text-danger">
          {error}
        </p>
      )}
      <p className="mt-2 text-center text-xs text-muted">Podés cancelar hasta {cancelMinHours} horas antes.</p>
    </div>
  );
}
