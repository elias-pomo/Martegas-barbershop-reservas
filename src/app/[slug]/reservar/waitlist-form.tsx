"use client";

import { BellPlus, Check, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { formatLongDate } from "@/lib/format";
import { getSavedContact, saveContact } from "@/lib/saved-appointments";
import { joinWaitlistAction } from "./actions";
import type { BookingBusiness } from "./booking-flow";

/** Día completo: el cliente se anota y el barbero le escribe si se libera un lugar. */
export function WaitlistForm({
  business,
  service,
  day,
}: {
  business: BookingBusiness;
  service: { id: string; name: string };
  day: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const saved = getSavedContact();
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura de localStorage tras montar
    setName(saved.name);
    setPhone(saved.phone);
  }, []);

  const dayLabel = formatLongDate(`${day}T12:00:00Z`, "UTC");

  if (joined) {
    return (
      <div className="mt-4 flex flex-col items-center rounded-2xl border border-accent/30 bg-accent/10 p-5 text-center">
        <span className="glow-green flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Check className="size-6" strokeWidth={3} aria-hidden />
        </span>
        <p className="mt-3 font-semibold">¡Te anotamos!</p>
        <p className="mt-1 text-sm text-muted">
          Si se libera un lugar el {dayLabel}, {business.name} te va a escribir por WhatsApp.
        </p>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await joinWaitlistAction({ slug: business.slug, day, serviceId: service.id, name, phone });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      saveContact({ name: name.trim(), phone: phone.trim() });
      setJoined(true);
    });
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <BellPlus className="size-5 text-primary" aria-hidden />
        <p className="font-semibold first-letter:uppercase">{dayLabel} está completo</p>
      </div>
      <p className="mt-1 text-sm text-muted">Anotate en la lista de espera: si alguien cancela, te avisamos por WhatsApp.</p>
      <div className="mt-3 grid gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          autoComplete="name"
          placeholder="Nombre y apellido"
          aria-label="Nombre y apellido"
          className="h-12 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Celular (381 1234567)"
          aria-label="Celular"
          className="h-12 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
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
        className={`btn-neon mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold ${pending ? "is-loading" : ""}`}
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Anotarme en lista de espera
      </button>
    </form>
  );
}
