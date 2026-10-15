"use client";

import { motion } from "motion/react";
import { ArrowLeft, CalendarPlus, ChevronRight, KeyRound, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatLongDate, formatTime } from "@/lib/format";
import {
  getSavedAppointments,
  getSavedContact,
  removeSavedAppointment,
  type SavedAppointment,
} from "@/lib/saved-appointments";
import { getAppointmentStatuses, lookupAppointment } from "./actions";

export function MyAppointments({ slug, timeZone }: { slug: string; timeZone: string }) {
  const [appointments, setAppointments] = useState<SavedAppointment[] | null>(null);

  useEffect(() => {
    const saved = getSavedAppointments(slug).filter((a) => new Date(a.endsAt).getTime() > Date.now());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura de localStorage tras montar
    setAppointments(saved.sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    if (!saved.length) return;

    // Se descartan los que fueron cancelados (por el cliente en otro lado o por el negocio).
    getAppointmentStatuses(slug, saved.map((a) => a.token)).then((statuses) => {
      const active = saved.filter((a) => statuses[a.token] === "CONFIRMED");
      saved.filter((a) => !active.includes(a)).forEach((a) => removeSavedAppointment(slug, a.token));
      setAppointments(active);
    });
  }, [slug]);

  return (
    <>
      <Link
        href={`/${slug}`}
        className="-ml-2 flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
        aria-label="Volver al inicio"
      >
        <ArrowLeft className="size-5" />
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Mis turnos</h1>

      {appointments === null ? (
        <div className="mt-6 h-20 animate-pulse rounded-2xl bg-surface" />
      ) : appointments.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-muted">No tenés turnos próximos en este celular.</p>
          <Link
            href={`/${slug}/reservar`}
            className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
          >
            <CalendarPlus className="size-4" aria-hidden />
            Reservar turno
          </Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {appointments.map((a, i) => (
            <motion.li key={a.token} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link
                href={`/${slug}/turno/${a.token}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/60 active:scale-[0.98]"
              >
                <span className="flex w-14 flex-col items-center rounded-xl bg-primary/15 py-2 text-primary">
                  <span className="text-lg font-semibold leading-none">{formatTime(a.startsAt, timeZone)}</span>
                </span>
                <span className="flex-1">
                  <span className="block font-medium first-letter:uppercase">{formatLongDate(a.startsAt, timeZone)}</span>
                  <span className="text-sm text-muted">{a.serviceName}</span>
                </span>
                <ChevronRight className="size-5 text-muted" aria-hidden />
              </Link>
            </motion.li>
          ))}
        </ul>
      )}

      <LookupForm slug={slug} />
    </>
  );
}

function LookupForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const saved = getSavedContact()?.phone;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura de localStorage tras montar
    if (saved) setPhone(saved);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await lookupAppointment({ slug, phone, code });
      if (result.ok) router.push(`/${slug}/turno/${result.token}`);
      else setError(result.message);
    });
  };

  return (
    <form onSubmit={submit} className="mt-10 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-primary" aria-hidden />
        <h2 className="font-medium">¿Reservaste desde otro celular?</h2>
      </div>
      <p className="mt-1 text-sm text-muted">Buscá tu turno con tu teléfono y el código de 4 dígitos.</p>
      <div className="mt-4 grid grid-cols-[1fr_6.5rem] gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="381 1234567"
          aria-label="Teléfono"
          className="h-12 min-w-0 rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{4}"
          placeholder="0000"
          aria-label="Código"
          className="h-12 min-w-0 rounded-xl border border-border bg-background px-3 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary/50 font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-70"
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Buscar turno
      </button>
    </form>
  );
}
