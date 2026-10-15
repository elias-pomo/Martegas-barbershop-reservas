"use client";

import { Check, Loader2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { businessCancelLink, confirmationLink } from "@/lib/domain/messages";
import { formatPrice, formatTime } from "@/lib/format";
import { addAppointment, addBlock } from "./actions";
import type { ConflictInfo } from "@/lib/admin";
import { Sheet } from "./sheet";
import type { AgendaBusiness } from "./types";
import { useMessageContext } from "./use-message-context";

export interface NewEntryPreset {
  mode: "appointment" | "block";
  day: string;
  time?: string;
}

const inputClass =
  "mt-1 h-12 w-full rounded-xl border border-border bg-surface px-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30";

export function NewEntrySheet({
  business,
  preset,
  onClose,
}: {
  business: AgendaBusiness;
  preset: NewEntryPreset | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<NewEntryPreset["mode"]>("appointment");
  const [lastPreset, setLastPreset] = useState(preset);

  // Al abrir con otro preset, se toma su modo (patrón de "ajustar estado al cambiar props").
  if (preset !== lastPreset) {
    setLastPreset(preset);
    if (preset) setMode(preset.mode);
  }

  return (
    <Sheet open={!!preset} onClose={onClose} title={mode === "appointment" ? "Cargar turno" : "Bloquear horario"}>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1" role="tablist">
        {(["appointment", "block"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`h-10 rounded-lg text-sm font-medium transition ${mode === m ? "glow-purple bg-primary text-primary-foreground" : "text-muted"}`}
          >
            {m === "appointment" ? "Turno" : "Bloqueo"}
          </button>
        ))}
      </div>
      {preset &&
        (mode === "appointment" ? (
          <AppointmentForm key={`a-${preset.day}-${preset.time}`} business={business} preset={preset} onDone={onClose} />
        ) : (
          <BlockForm key={`b-${preset.day}-${preset.time}`} business={business} preset={preset} onDone={onClose} />
        ))}
    </Sheet>
  );
}

/* ---------- Turno manual ---------- */

function AppointmentForm({
  business,
  preset,
  onDone,
}: {
  business: AgendaBusiness;
  preset: NewEntryPreset;
  onDone: () => void;
}) {
  const router = useRouter();
  const ctx = useMessageContext(business);
  const first = business.services[0];
  const [type, setType] = useState<"REGULAR" | "SPECIAL">("REGULAR");
  const [serviceId, setServiceId] = useState(first?.id ?? "");
  const [day, setDay] = useState(preset.day);
  const [time, setTime] = useState(preset.time ?? "15:00");
  const [durationMin, setDurationMin] = useState(first?.durationMin ?? 60);
  const [price, setPrice] = useState(first?.price ?? 0);
  const [people, setPeople] = useState(1);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ link: string; when: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const pickService = (id: string) => {
    const s = business.services.find((sv) => sv.id === id);
    setServiceId(id);
    if (s) {
      setDurationMin(s.durationMin);
      setPrice(s.price * people);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addAppointment({
        day,
        time,
        type,
        serviceId: type === "REGULAR" ? serviceId : undefined,
        durationMin,
        price,
        people,
        address: type === "SPECIAL" ? address : undefined,
        notes,
        name,
        phone,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const serviceName =
        type === "REGULAR" ? (business.services.find((s) => s.id === serviceId)?.name ?? "Turno") : "Turno especial";
      setCreated({
        when: `${formatTime(result.startsAt, business.timeZone)}`,
        link: confirmationLink(ctx, {
          customerName: name,
          phone: result.phone,
          serviceName,
          startsAt: result.startsAt,
          token: result.token,
          code: result.code,
        }),
      });
      router.refresh();
    });
  };

  if (created) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Check className="size-7" strokeWidth={3} aria-hidden />
        </span>
        <p className="mt-3 text-lg font-semibold">Turno cargado a las {created.when}</p>
        <p className="mt-1 text-sm text-muted">Mandale la confirmación con el link para ver o cancelar.</p>
        <a
          href={created.link}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-accent-foreground"
        >
          <MessageCircle className="size-5" aria-hidden />
          Enviar confirmación
        </a>
        <button type="button" onClick={onDone} className="mt-2 h-12 w-full rounded-xl text-sm font-medium text-muted">
          Listo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {(["REGULAR", "SPECIAL"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              if (t === "REGULAR") pickService(serviceId);
            }}
            aria-pressed={type === t}
            className={`h-11 rounded-xl border text-sm font-medium ${type === t ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface text-muted"}`}
          >
            {t === "REGULAR" ? "Normal" : "Especial / domicilio"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm font-medium">
          Día
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          Hora
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required step={300} className={inputClass} />
        </label>
      </div>

      {type === "REGULAR" ? (
        <label className="text-sm font-medium">
          Servicio
          <select value={serviceId} onChange={(e) => pickService(e.target.value)} className={inputClass}>
            {business.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatPrice(s.price)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-sm font-medium">
              Duración
              <select value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} className={inputClass}>
                {[30, 60, 90, 120, 150, 180, 240].map((m) => (
                  <option key={m} value={m}>
                    {m >= 60 ? `${m / 60} h` : `${m} min`}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Personas
              <input
                type="number"
                min={1}
                max={20}
                value={people}
                onChange={(e) => setPeople(Number(e.target.value))}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium">
              Precio
              <input
                type="number"
                min={0}
                step={500}
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className={inputClass}
              />
            </label>
          </div>
          <p className="-mt-1 text-xs text-muted">
            Referencia fuera de horario: +{formatPrice(business.specialSurchargePerPerson)} por persona.
          </p>
          <label className="text-sm font-medium">
            Dirección <span className="font-normal text-muted">(si es a domicilio)</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} className={inputClass} />
          </label>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm font-medium">
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoCapitalize="words" className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          Celular
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            type="tel"
            inputMode="tel"
            placeholder="381 1234567"
            className={inputClass}
          />
        </label>
      </div>

      <label className="text-sm font-medium">
        Nota <span className="font-normal text-muted">(opcional)</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} className={inputClass} />
      </label>

      {error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`btn-neon mt-1 flex h-14 items-center justify-center gap-2 rounded-2xl font-semibold ${pending ? "is-loading" : ""}`}
      >
        {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
        Guardar turno
      </button>
    </form>
  );
}

/* ---------- Bloqueo ---------- */

function BlockForm({
  business,
  preset,
  onDone,
}: {
  business: AgendaBusiness;
  preset: NewEntryPreset;
  onDone: () => void;
}) {
  const router = useRouter();
  const ctx = useMessageContext(business);
  const [day, setDay] = useState(preset.day);
  const [allDay, setAllDay] = useState(!preset.time);
  const [from, setFrom] = useState(preset.time ?? "15:00");
  const [to, setTo] = useState(() => {
    const [h, m] = (preset.time ?? "15:00").split(":").map(Number);
    return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });
  const [reason, setReason] = useState("");
  const [conflicts, setConflicts] = useState<ConflictInfo[] | null>(null);
  const [notify, setNotify] = useState<ConflictInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = (cancelConflicts: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await addBlock({ day, allDay, from, to, reason, cancelConflicts });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (!result.blocked) {
        setConflicts(result.conflicts);
        return;
      }
      router.refresh();
      if (result.conflicts.length) setNotify(result.conflicts);
      else onDone();
    });
  };

  if (notify) {
    return (
      <div className="mt-4">
        <p className="font-medium">Horario bloqueado. Avisales a los clientes:</p>
        <ul className="mt-3 flex flex-col gap-2">
          {notify.map((c) => (
            <li key={c.id}>
              <a
                href={businessCancelLink(ctx, {
                  customerName: c.customerName,
                  phone: c.phone,
                  serviceName: c.serviceName,
                  startsAt: c.startsAt,
                  token: c.token,
                })}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 items-center justify-between rounded-xl bg-accent/15 px-3 text-sm font-semibold text-accent"
              >
                <span>
                  {formatTime(c.startsAt, business.timeZone)} · {c.customerName}
                </span>
                <MessageCircle className="size-4" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onDone} className="mt-4 h-12 w-full rounded-xl bg-surface font-medium">
          Listo
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(false);
      }}
      className="mt-4 flex flex-col gap-3"
    >
      <label className="text-sm font-medium">
        Día
        <input
          type="date"
          value={day}
          onChange={(e) => {
            setDay(e.target.value);
            setConflicts(null);
          }}
          required
          className={inputClass}
        />
      </label>

      <label className="flex h-12 items-center justify-between rounded-xl border border-border bg-surface px-3 text-sm font-medium">
        Todo el día
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => {
            setAllDay(e.target.checked);
            setConflicts(null);
          }}
          className="size-5 accent-[var(--primary)]"
        />
      </label>

      {!allDay && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-medium">
            Desde
            <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} required className={inputClass} />
          </label>
          <label className="text-sm font-medium">
            Hasta
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} required className={inputClass} />
          </label>
        </div>
      )}

      <label className="text-sm font-medium">
        Motivo <span className="font-normal text-muted">(opcional, solo lo ves vos)</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={100} placeholder="Trámite, feriado…" className={inputClass} />
      </label>

      {conflicts && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">
          <p className="font-medium">
            Hay {conflicts.length} {conflicts.length === 1 ? "turno" : "turnos"} en ese horario:
          </p>
          <ul className="mt-1 text-muted">
            {conflicts.map((c) => (
              <li key={c.id}>
                {formatTime(c.startsAt, business.timeZone)} · {c.customerName}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={pending}
            onClick={() => send(true)}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-danger font-semibold text-white disabled:opacity-70"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Cancelarlos y bloquear
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {!conflicts && (
        <button
          type="submit"
          disabled={pending}
          className={`btn-neon mt-1 flex h-14 items-center justify-center gap-2 rounded-2xl font-semibold ${pending ? "is-loading" : ""}`}
        >
          {pending && <Loader2 className="size-5 animate-spin" aria-hidden />}
          Bloquear
        </button>
      )}
    </form>
  );
}
