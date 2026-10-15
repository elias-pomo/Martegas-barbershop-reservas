"use client";

import {
  Bell,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  MessageSquareText,
  Plus,
  Scissors,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { renderTemplate } from "@/lib/domain/whatsapp";
import { formatPrice } from "@/lib/format";
import { logout } from "../../login/actions";
import {
  changePassword,
  saveHoursAction,
  saveInfo,
  savePolicies,
  saveServicesAction,
  saveTemplates,
} from "./actions";
import { NotificationsPanel } from "./notifications-panel";

type Result = { ok: true } | { ok: false; message: string };

interface Props {
  email: string;
  vapidKey: string | null;
  slug: string;
  info: { name: string; address: string; whatsapp: string; instagram: string; paymentAlias: string; paymentHolder: string };
  services: { id: string; name: string; durationMin: number; price: number; active: boolean }[];
  hours: { weekday: number; open: boolean; firstStart: string; lastStart: string }[];
  policies: {
    slotIntervalMin: number;
    minLeadMin: number;
    cancelMinHours: number;
    maxPerWeek: number;
    minDaysBetween: number;
    noShowBlockThreshold: number;
    specialSurchargePerPerson: number;
  };
  templates: { reminder: string; businessCancel: string; confirmation: string; waitlistOffer: string; generic: string };
}

const input =
  "mt-1 h-12 w-full rounded-xl border border-border bg-background px-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30";
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function SettingsView(props: Props) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <a
        href={`/${props.slug}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm"
      >
        <span>
          Página para clientes: <span className="font-semibold">/{props.slug}</span>
        </span>
        <ExternalLink className="size-4 text-primary" aria-hidden />
      </a>

      <Section icon={<Bell className="size-5" />} title="Avisos en este celular" subtitle="Turnos nuevos y cancelados">
        <NotificationsPanel vapidKey={props.vapidKey} />
      </Section>
      <Section icon={<Store className="size-5" />} title="Negocio" subtitle="Nombre, dirección, WhatsApp y alias">
        <InfoForm info={props.info} />
      </Section>
      <Section icon={<Scissors className="size-5" />} title="Servicios y precios" subtitle={`${props.services.filter((s) => s.active).length} activos`}>
        <ServicesForm services={props.services} />
      </Section>
      <Section icon={<Clock className="size-5" />} title="Horarios" subtitle="Días y horas de atención">
        <HoursForm hours={props.hours} />
      </Section>
      <Section icon={<ShieldCheck className="size-5" />} title="Reglas de reserva" subtitle="Anticipación, cancelación, límites">
        <PoliciesForm policies={props.policies} />
      </Section>
      <Section icon={<MessageSquareText className="size-5" />} title="Mensajes de WhatsApp" subtitle="Textos de recordatorio y avisos">
        <TemplatesForm templates={props.templates} />
      </Section>
      <Section icon={<KeyRound className="size-5" />} title="Cuenta" subtitle={props.email}>
        <AccountForm />
      </Section>
    </div>
  );
}

/* ---------- Piezas comunes ---------- */

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-border bg-surface open:pb-4">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{title}</span>
          <span className="block truncate text-xs text-muted">{subtitle}</span>
        </span>
        <ChevronDown className="size-5 text-muted transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-4">{children}</div>
    </details>
  );
}

/** Guardar con estados: guardando, guardado o error. Refresca la página al guardar. */
function useSave() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message?: string } | null>(null);

  const save = (action: () => Promise<Result>) => {
    setStatus(null);
    startTransition(async () => {
      const result = await action();
      setStatus(result.ok ? { ok: true } : { ok: false, message: result.message });
      if (result.ok) {
        router.refresh();
        setTimeout(() => setStatus(null), 2500);
      }
    });
  };
  return { pending, status, save };
}

function SaveBar({ pending, status, label = "Guardar" }: { pending: boolean; status: { ok: boolean; message?: string } | null; label?: string }) {
  return (
    <div className="mt-4">
      {status && !status.ok && (
        <p role="alert" className="mb-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          {status.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-70 ${
          status?.ok ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
        }`}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : status?.ok && <Check className="size-4" aria-hidden />}
        {status?.ok ? "Guardado" : label}
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block text-sm font-medium first:mt-0">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

/* ---------- Negocio ---------- */

function InfoForm({ info }: { info: Props["info"] }) {
  const [values, setValues] = useState(info);
  const { pending, status, save } = useSave();
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => saveInfo(values));
      }}
    >
      <Field label="Nombre">
        <input value={values.name} onChange={set("name")} required className={input} />
      </Field>
      <Field label="Dirección" hint="Se usa también para el link de Google Maps.">
        <input value={values.address} onChange={set("address")} className={input} />
      </Field>
      <Field label="WhatsApp" hint="Si es de otro país, con + y el código (ej. +34…).">
        <input value={values.whatsapp} onChange={set("whatsapp")} type="tel" inputMode="tel" className={input} />
      </Field>
      <Field label="Instagram (link)">
        <input value={values.instagram} onChange={set("instagram")} type="url" placeholder="https://www.instagram.com/…" className={input} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Alias / CBU">
          <input value={values.paymentAlias} onChange={set("paymentAlias")} className={input} />
        </Field>
        <Field label="Titular">
          <input value={values.paymentHolder} onChange={set("paymentHolder")} className={input} />
        </Field>
      </div>
      <SaveBar pending={pending} status={status} />
    </form>
  );
}

/* ---------- Servicios ---------- */

const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180];

function ServicesForm({ services }: { services: Props["services"] }) {
  const [rows, setRows] = useState<(Omit<Props["services"][number], "id"> & { id?: string; key: string })[]>(
    services.map((s) => ({ ...s, key: s.id })),
  );
  const { pending, status, save } = useSave();
  const update = (key: string, patch: Partial<(typeof rows)[number]>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() =>
          saveServicesAction(rows.map((r) => ({ id: r.id, name: r.name, durationMin: r.durationMin, price: r.price, active: r.active }))),
        );
      }}
    >
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.key} className={`rounded-xl border border-border bg-background p-3 ${r.active ? "" : "opacity-60"}`}>
            <div className="flex items-center gap-2">
              <input
                value={r.name}
                onChange={(e) => update(r.key, { name: e.target.value })}
                required
                aria-label="Nombre del servicio"
                placeholder="Nombre"
                className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-base font-medium outline-none focus:border-primary"
              />
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={r.active}
                  onChange={(e) => update(r.key, { active: e.target.checked })}
                  className="size-4 accent-[var(--primary)]"
                />
                Activo
              </label>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                value={r.durationMin}
                onChange={(e) => update(r.key, { durationMin: Number(e.target.value) })}
                aria-label="Duración"
                className="h-10 rounded-lg border border-border bg-surface px-2 text-base"
              >
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`}
                  </option>
                ))}
              </select>
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                <input
                  type="number"
                  min={0}
                  step={500}
                  inputMode="numeric"
                  value={r.price}
                  onChange={(e) => update(r.key, { price: Number(e.target.value) })}
                  aria-label="Precio"
                  className="h-10 w-full rounded-lg border border-border bg-surface pl-5 pr-2 text-base"
                />
              </div>
            </div>
            {!r.id && <p className="mt-1 text-xs text-accent">Nuevo · {formatPrice(r.price)}</p>}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          setRows((rs) => [...rs, { key: crypto.randomUUID(), name: "", durationMin: 60, price: 0, active: true }])
        }
        className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-sm font-medium text-muted hover:text-foreground"
      >
        <Plus className="size-4" aria-hidden />
        Agregar servicio
      </button>
      <p className="mt-2 text-xs text-muted">
        Para dejar de ofrecer un servicio, desactivalo: así se conserva el historial de turnos.
      </p>
      <SaveBar pending={pending} status={status} />
    </form>
  );
}

/* ---------- Horarios ---------- */

function HoursForm({ hours }: { hours: Props["hours"] }) {
  const [rows, setRows] = useState(hours);
  const { pending, status, save } = useSave();
  const update = (weekday: number, patch: Partial<Props["hours"][number]>) =>
    setRows((rs) => rs.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
  // Lunes primero, domingo al final.
  const ordered = [...rows.slice(1), rows[0]];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => saveHoursAction(rows));
      }}
    >
      <p className="mb-2 text-xs text-muted">Primer y último horario en que puede empezar un turno.</p>
      <ul className="flex flex-col gap-1.5">
        {ordered.map((r) => (
          <li key={r.weekday} className="rounded-xl bg-background px-3 py-2">
            {/* Día arriba y horas abajo: los campos de hora de iOS no entran al lado en pantallas chicas. */}
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={r.open}
                  onChange={(e) => update(r.weekday, { open: e.target.checked })}
                  className="size-4 accent-[var(--primary)]"
                />
                {WEEKDAYS[r.weekday]}
              </label>
              {!r.open && <span className="text-sm text-muted">Cerrado</span>}
            </div>
            {r.open && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <label className="min-w-0 text-xs text-muted">
                  Primer turno
                  <input
                    type="time"
                    value={r.firstStart}
                    onChange={(e) => update(r.weekday, { firstStart: e.target.value })}
                    className="mt-0.5 h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-2 text-base text-foreground"
                  />
                </label>
                <label className="min-w-0 text-xs text-muted">
                  Último turno
                  <input
                    type="time"
                    value={r.lastStart}
                    onChange={(e) => update(r.weekday, { lastStart: e.target.value })}
                    className="mt-0.5 h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-2 text-base text-foreground"
                  />
                </label>
              </div>
            )}
          </li>
        ))}
      </ul>
      <SaveBar pending={pending} status={status} />
    </form>
  );
}

/* ---------- Reglas ---------- */

function PoliciesForm({ policies }: { policies: Props["policies"] }) {
  const [v, setV] = useState(policies);
  const { pending, status, save } = useSave();
  const num = (key: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [key]: Number(e.target.value) }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => savePolicies(v));
      }}
    >
      <Field label="Turnos cada">
        <select value={v.slotIntervalMin} onChange={num("slotIntervalMin")} className={input}>
          <option value={15}>15 minutos</option>
          <option value={30}>30 minutos</option>
          <option value={60}>1 hora</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Reservar hasta (min antes)">
          <input type="number" min={0} max={1440} value={v.minLeadMin} onChange={num("minLeadMin")} className={input} />
        </Field>
        <Field label="Cancelar hasta (horas antes)">
          <input type="number" min={0} max={72} step={0.5} value={v.cancelMinHours} onChange={num("cancelMinHours")} className={input} />
        </Field>
        <Field label="Turnos por semana (máx.)">
          <input type="number" min={1} max={7} value={v.maxPerWeek} onChange={num("maxPerWeek")} className={input} />
        </Field>
        <Field label="Días entre turnos (mín.)">
          <input type="number" min={0} max={6} value={v.minDaysBetween} onChange={num("minDaysBetween")} className={input} />
        </Field>
        <Field label="Faltas para bloquear">
          <input type="number" min={1} max={100} value={v.noShowBlockThreshold} onChange={num("noShowBlockThreshold")} className={input} />
        </Field>
        <Field label="Recargo especial ($/persona)">
          <input type="number" min={0} step={500} value={v.specialSurchargePerPerson} onChange={num("specialSurchargePerPerson")} className={input} />
        </Field>
      </div>
      <p className="mt-2 text-xs text-muted">
        Con estas reglas: se reserva hasta {v.minLeadMin} min antes, se cancela online hasta {v.cancelMinHours} h antes y cada
        persona puede tener {v.maxPerWeek === 1 ? "1 turno" : `hasta ${v.maxPerWeek} turnos`} por semana
        {v.maxPerWeek > 1 && ` (con ${v.minDaysBetween} días de diferencia)`}.
      </p>
      <SaveBar pending={pending} status={status} />
    </form>
  );
}

/* ---------- Mensajes ---------- */

const TEMPLATE_FIELDS: { key: keyof Props["templates"]; label: string; vars: string }[] = [
  { key: "reminder", label: "Recordatorio", vars: "{nombre} {servicio} {cuando} {hora} {negocio} {direccion}" },
  { key: "confirmation", label: "Confirmación (turno cargado por vos)", vars: "{nombre} {cuando} {hora} {negocio} {direccion} {link} {codigo}" },
  { key: "businessCancel", label: "Cancelación tuya", vars: "{nombre} {dia} {hora} {link}" },
  { key: "waitlistOffer", label: "Lugar liberado (lista de espera)", vars: "{nombre} {dia} {negocio} {link}" },
  { key: "generic", label: "Saludo (botón WhatsApp del cliente)", vars: "{nombre}" },
];

const SAMPLE = {
  nombre: "Juan",
  servicio: "Corte",
  cuando: "mañana",
  dia: "jueves 15 de octubre",
  hora: "18:00",
  negocio: "Tu barbería",
  direccion: "Tu dirección",
  link: "https://…",
  codigo: "1234",
};

function TemplatesForm({ templates }: { templates: Props["templates"] }) {
  const [v, setV] = useState(templates);
  const { pending, status, save } = useSave();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => saveTemplates(v));
      }}
    >
      {TEMPLATE_FIELDS.map((f) => (
        <div key={f.key} className="mt-4 first:mt-0">
          <label className="block text-sm font-medium">
            {f.label}
            <textarea
              value={v[f.key]}
              onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <p className="text-[11px] text-muted">Variables: {f.vars}</p>
          <p className="mt-1 rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">{renderTemplate(v[f.key], SAMPLE)}</p>
        </div>
      ))}
      <SaveBar pending={pending} status={status} />
    </form>
  );
}

/* ---------- Cuenta ---------- */

function AccountForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const { pending, status, save } = useSave();
  const mismatch = repeat.length > 0 && next !== repeat;

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (mismatch) return;
          save(async () => {
            const result = await changePassword(current, next);
            if (result.ok) {
              setCurrent("");
              setNext("");
              setRepeat("");
            }
            return result;
          });
        }}
      >
        <p className="text-sm font-medium">Cambiar contraseña</p>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="Contraseña actual"
          aria-label="Contraseña actual"
          className={input}
        />
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={10}
          autoComplete="new-password"
          placeholder="Nueva (mín. 10, letras y números)"
          aria-label="Contraseña nueva"
          className={input}
        />
        <input
          type="password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="Repetir la nueva"
          aria-label="Repetir contraseña nueva"
          aria-invalid={mismatch}
          className={`${input} aria-[invalid=true]:border-danger`}
        />
        {mismatch && <p className="mt-1 text-xs text-danger">No coinciden.</p>}
        <p className="mt-2 text-xs text-muted">Se cierra la sesión en los demás dispositivos.</p>
        <SaveBar pending={pending} status={status} label="Cambiar contraseña" />
      </form>

      <form action={logout} className="mt-4 border-t border-border pt-4">
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-muted hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden />
          Cerrar sesión
        </button>
      </form>
    </>
  );
}
