"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  CalendarX2,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Loader2,
  MessageCircle,
  Scissors,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { AvailabilityResponse } from "@/app/api/[slug]/availability/route";
import type { BookingError } from "@/lib/booking";
import { waLink } from "@/lib/domain/whatsapp";
import {
  dayChipParts,
  formatDuration,
  formatLongDate,
  formatPrice,
  formatTime,
} from "@/lib/format";
import {
  getSavedContact,
  saveAppointment,
  saveContact,
  type SavedAppointment,
} from "@/lib/saved-appointments";
import { bookAppointment } from "./actions";

export interface BookingBusiness {
  slug: string;
  name: string;
  address: string | null;
  timeZone: string;
  whatsapp: string | null;
  paymentAlias: string | null;
  paymentHolder: string | null;
  staffLabel: string;
  services: { id: string; name: string; durationMin: number; price: number }[];
}

type Service = BookingBusiness["services"][number];
type Step = "service" | "slot" | "details" | "done";
const STEPS: Step[] = ["service", "slot", "details"];

export function BookingFlow({ business }: { business: BookingBusiness }) {
  const [step, setStep] = useState<Step>("service");
  const [direction, setDirection] = useState(1);
  const [service, setService] = useState<Service | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [booked, setBooked] = useState<SavedAppointment | null>(null);

  const go = (next: Step) => {
    setDirection(STEPS.indexOf(next) >= STEPS.indexOf(step) ? 1 : -1);
    setStep(next);
  };

  const back = () => {
    setNotice(null);
    if (step === "slot") go("service");
    else if (step === "details") go("slot");
  };

  return (
    <div className="flex flex-1 flex-col">
      {step !== "done" && (
        <header className="flex items-center justify-between">
          {step === "service" ? (
            <Link
              href={`/${business.slug}`}
              className="-ml-2 flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
              aria-label="Volver al inicio"
            >
              <ArrowLeft className="size-5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={back}
              className="-ml-2 flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
              aria-label="Paso anterior"
            >
              <ArrowLeft className="size-5" />
            </button>
          )}
          <StepDots current={STEPS.indexOf(step)} />
          <span className="size-11" aria-hidden />
        </header>
      )}

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={step}
          custom={direction}
          initial={{ opacity: 0, x: direction * 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -32 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-1 flex-col"
        >
          {step === "service" && (
            <ServiceStep
              services={business.services}
              onSelect={(s) => {
                setService(s);
                setSlot(null);
                go("slot");
              }}
            />
          )}
          {step === "slot" && service && (
            <SlotStep
              business={business}
              service={service}
              notice={notice}
              onSelect={(iso) => {
                setSlot(iso);
                setNotice(null);
                go("details");
              }}
            />
          )}
          {step === "details" && service && slot && (
            <DetailsStep
              business={business}
              service={service}
              slot={slot}
              onSlotTaken={(message) => {
                setNotice(message);
                go("slot");
              }}
              onBooked={(appointment) => {
                setBooked(appointment);
                setStep("done");
              }}
            />
          )}
          {step === "done" && booked && <DoneStep business={business} appointment={booked} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StepDots({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label={`Paso ${current + 1} de ${STEPS.length}`}>
      {STEPS.map((s, i) => (
        <li
          key={s}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === current ? "w-8 bg-primary" : i < current ? "w-4 bg-primary/60" : "w-4 bg-border"
          }`}
        />
      ))}
    </ol>
  );
}

function StepTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

/* ---------- Paso 1: servicio ---------- */

function ServiceStep({ services, onSelect }: { services: Service[]; onSelect: (s: Service) => void }) {
  return (
    <>
      <StepTitle subtitle="Elegí qué te vas a hacer">¿Qué servicio?</StepTitle>
      <ul className="mt-6 flex flex-col gap-3">
        {services.map((service) => (
          <li key={service.id}>
            <button
              type="button"
              onClick={() => onSelect(service)}
              className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left transition hover:border-primary/60 active:scale-[0.98]"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Scissors className="size-6" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block text-lg font-medium">{service.name}</span>
                <span className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                  <Clock className="size-3.5" aria-hidden />
                  {formatDuration(service.durationMin)}
                </span>
              </span>
              <span className="font-semibold text-accent">{formatPrice(service.price)}</span>
              <ChevronRight className="size-5 text-muted transition group-hover:translate-x-0.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------- Paso 2: día y hora ---------- */

function SlotStep({
  business,
  service,
  notice,
  onSelect,
}: {
  business: BookingBusiness;
  service: Service;
  notice: string | null;
  onSelect: (iso: string) => void;
}) {
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch(`/api/${business.slug}/availability?serviceId=${service.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as AvailabilityResponse;
      setData(json);
      setSelectedDate((current) =>
        current && json.days.some((d) => d.date === current && d.slots.length)
          ? current
          : (json.days.find((d) => d.slots.length)?.date ?? json.days[0]?.date ?? null),
      );
    } catch {
      setFailed(true);
    }
  }, [business.slug, service.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos externos
    load();
  }, [load]);

  const day = data?.days.find((d) => d.date === selectedDate);
  const noSlotsAtAll = data && data.days.every((d) => d.slots.length === 0);

  return (
    <>
      <StepTitle subtitle={`${service.name} · ${formatDuration(service.durationMin)}`}>¿Cuándo?</StepTitle>

      {notice && (
        <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          {notice}
        </p>
      )}

      {failed && (
        <div className="mt-8 text-center">
          <p className="text-muted">No pudimos cargar los horarios.</p>
          <button type="button" onClick={load} className="mt-3 font-medium text-primary">
            Reintentar
          </button>
        </div>
      )}

      {!data && !failed && <SlotsSkeleton />}

      {data && noSlotsAtAll && <NoSlots business={business} />}

      {data && !noSlotsAtAll && (
        <>
          <div className="-mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
            {data.days.map((d) => {
              const { weekday, day: num } = dayChipParts(d.date);
              const available = d.slots.length > 0;
              const selected = d.date === selectedDate;
              return (
                <button
                  key={d.date}
                  type="button"
                  disabled={!available}
                  onClick={() => setSelectedDate(d.date)}
                  aria-pressed={selected}
                  className={`flex w-16 shrink-0 flex-col items-center rounded-2xl border py-3 transition active:scale-95 ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : available
                        ? "border-border bg-surface hover:border-primary/60"
                        : "border-transparent bg-surface/40 text-muted/50"
                  }`}
                >
                  <span className="text-xs uppercase">{weekday}</span>
                  <span className="text-xl font-semibold">{num}</span>
                  <span className={`mt-0.5 text-[10px] ${selected ? "text-primary-foreground/80" : "text-muted"}`}>
                    {!d.open ? "cerrado" : available ? `${d.slots.length} libres` : "completo"}
                  </span>
                </button>
              );
            })}
          </div>

          {day && (
            <div className="mt-4">
              <p className="text-sm text-muted first-letter:uppercase">
                {formatLongDate(`${day.date}T12:00:00Z`, "UTC")}
              </p>
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {day.slots.map((iso, i) => (
                  <motion.li
                    key={iso}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(iso)}
                      className="h-14 w-full rounded-xl border border-accent/30 bg-accent/10 text-lg font-semibold text-accent transition hover:bg-accent/20 active:scale-95"
                    >
                      {formatTime(iso, data.timeZone)}
                    </button>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-auto pt-8 text-center text-xs text-muted">
            ¿Necesitás otro horario o a domicilio?{" "}
            <Link href={`/${business.slug}/especial`} className="font-medium text-primary">
              Pedí un turno especial
            </Link>
          </p>
        </>
      )}
    </>
  );
}

function NoSlots({ business }: { business: BookingBusiness }) {
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-surface text-muted">
        <CalendarX2 className="size-7" aria-hidden />
      </span>
      <p className="mt-4 font-medium">No quedan turnos esta semana</p>
      <p className="mt-1 text-sm text-muted">Los turnos de la semana siguiente se habilitan el domingo.</p>
      <Link
        href={`/${business.slug}/especial`}
        className="mt-6 flex h-12 items-center justify-center rounded-xl border border-border bg-surface px-5 font-medium"
      >
        Pedir turno especial
      </Link>
    </div>
  );
}

function SlotsSkeleton() {
  return (
    <div className="mt-6 animate-pulse" aria-label="Cargando horarios">
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-[84px] w-16 shrink-0 rounded-2xl bg-surface" />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-14 rounded-xl bg-surface" />
        ))}
      </div>
    </div>
  );
}

/* ---------- Paso 3: datos ---------- */

function DetailsStep({
  business,
  service,
  slot,
  onSlotTaken,
  onBooked,
}: {
  business: BookingBusiness;
  service: Service;
  slot: string;
  onSlotTaken: (message: string) => void;
  onBooked: (appointment: SavedAppointment) => void;
}) {
  const [name, setName] = useState(() => getSavedContact()?.name ?? "");
  const [phone, setPhone] = useState(() => getSavedContact()?.phone ?? "");
  const [error, setError] = useState<BookingError | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await bookAppointment({
        slug: business.slug,
        serviceId: service.id,
        startsAt: slot,
        name,
        phone,
      });
      if (!result.ok) {
        if (result.error.code === "SLOT_TAKEN") onSlotTaken(result.error.message);
        else setError(result.error);
        return;
      }
      saveContact({ name: name.trim(), phone: phone.trim() });
      saveAppointment(business.slug, result.appointment);
      onBooked(result.appointment);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <StepTitle subtitle="Para confirmarte el turno">Tus datos</StepTitle>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm text-muted first-letter:uppercase">{formatLongDate(slot, business.timeZone)}</p>
        <div className="mt-1 flex items-baseline justify-between">
          <p className="text-lg font-semibold">
            {formatTime(slot, business.timeZone)} · {service.name}
          </p>
          <p className="font-semibold text-accent">{formatPrice(service.price)}</p>
        </div>
      </div>

      <label className="mt-6 block">
        <span className="text-sm font-medium">Nombre y apellido</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={60}
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          placeholder="Juan Pérez"
          className="mt-1.5 h-14 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none transition placeholder:text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Celular (WhatsApp)</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="done"
          placeholder="381 1234567"
          aria-invalid={error?.code === "INVALID_PHONE"}
          className="mt-1.5 h-14 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none transition placeholder:text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/30 aria-[invalid=true]:border-danger"
        />
      </label>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          <p>{error.message}</p>
          {error.code === "BLOCKED" && business.whatsapp && (
            <a
              href={waLink(business.whatsapp, `Hola! Quería pedir un turno de ${service.name}.`)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 font-medium text-accent"
            >
              <MessageCircle className="size-4" aria-hidden />
              Escribir por WhatsApp
            </a>
          )}
        </div>
      )}

      <div className="mt-auto pt-8">
        <button
          type="submit"
          disabled={pending}
          className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary-strong active:scale-[0.98] disabled:opacity-70"
        >
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Check className="size-5" aria-hidden />}
          {pending ? "Confirmando…" : "Confirmar turno"}
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          Usamos tu nombre y teléfono solo para gestionar tus turnos con {business.name}.
        </p>
      </div>
    </form>
  );
}

/* ---------- Confirmación ---------- */

function DoneStep({ business, appointment }: { business: BookingBusiness; appointment: SavedAppointment }) {
  const [copied, setCopied] = useState(false);

  const copyAlias = async () => {
    if (!business.paymentAlias) return;
    try {
      await navigator.clipboard.writeText(business.paymentAlias);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // portapapeles no disponible
    }
  };

  return (
    <div className="flex flex-1 flex-col pt-6">
      <div className="flex flex-col items-center text-center">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="flex size-20 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-xl shadow-accent/30"
        >
          <Check className="size-10" strokeWidth={3} aria-hidden />
        </motion.span>
        <h1 className="mt-5 text-2xl font-semibold">¡Turno confirmado!</h1>
        <p className="mt-1 text-muted first-letter:uppercase">{formatLongDate(appointment.startsAt, business.timeZone)}</p>
        <p className="mt-1 text-3xl font-semibold">{formatTime(appointment.startsAt, business.timeZone)}</p>
        <p className="mt-1 text-muted">
          {appointment.serviceName} · {formatPrice(appointment.price)}
        </p>
        {business.address && <p className="mt-1 text-sm text-muted">{business.address}</p>}
      </div>

      <div className="mt-8 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-center">
        <p className="text-sm text-muted">Tu código para cancelar</p>
        <p className="mt-1 font-mono text-4xl font-semibold tracking-[0.4em] text-primary">{appointment.code}</p>
        <p className="mt-1 text-xs text-muted">Guardalo: lo vas a necesitar si cambiás de celular.</p>
      </div>

      {business.paymentAlias && (
        <div className="mt-3 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">Pagás en el local: efectivo o transferencia</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="font-mono font-semibold">{business.paymentAlias}</p>
              {business.paymentHolder && <p className="text-xs text-muted">{business.paymentHolder}</p>}
            </div>
            <button
              type="button"
              onClick={copyAlias}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition hover:bg-surface-2"
            >
              {copied ? <Check className="size-4 text-accent" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-8">
        <Link
          href={`/${business.slug}/turno/${appointment.token}`}
          className="flex h-14 items-center justify-center rounded-2xl bg-primary font-semibold text-primary-foreground transition hover:bg-primary-strong active:scale-[0.98]"
        >
          Ver mi turno
        </Link>
        <Link
          href={`/${business.slug}`}
          className="flex h-14 items-center justify-center rounded-2xl border border-border bg-surface font-medium transition hover:bg-surface-2"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
