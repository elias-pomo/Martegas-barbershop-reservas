"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Home,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Undo2,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { businessCancelLink, reminderLink } from "@/lib/domain/messages";
import type { AppointmentStatus } from "@/lib/domain/rules";
import { addLocalDays } from "@/lib/domain/time";
import { dayChipParts, formatLongDate, formatPrice, formatTime } from "@/lib/format";
import { changeStatus, removeBlock } from "./actions";
import { InstallBanner } from "./install-banner";
import { NewEntrySheet, type NewEntryPreset } from "./new-entry-sheet";
import type { AgendaAppointment, AgendaBlock, AgendaData, AgendaEntry } from "./types";
import { useMessageContext } from "./use-message-context";

export function AgendaView({ data }: { data: AgendaData }) {
  const { business, day, today, week, entries } = data;
  const [preset, setPreset] = useState<NewEntryPreset | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);

  // Los cancelados no ocupan lugar: se agrupan al final para no ensuciar el día.
  const isCancelled = (e: AgendaEntry) => e.kind === "appointment" && e.item.status.startsWith("CANCELLED");
  const visibleEntries = entries.filter((e) => !isCancelled(e));
  const cancelled = entries.filter(isCancelled);

  const appointments = entries.flatMap((e) => (e.kind === "appointment" && e.item.active ? [e.item] : []));
  const total = appointments.reduce((sum, a) => sum + a.price, 0);
  const isClosedDay = !entries.some((e) => e.kind === "free") && appointments.length === 0;

  return (
    <>
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">{business.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        </div>
      </header>

      <InstallBanner />

      <WeekStrip week={week} day={day} today={today} />

      <div className="mt-5 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold first-letter:uppercase">
            {day === today ? "Hoy" : formatLongDate(`${day}T12:00:00Z`, "UTC")}
          </h2>
          <p className="text-sm text-muted">
            {appointments.length === 0
              ? "Sin turnos"
              : `${appointments.length} ${appointments.length === 1 ? "turno" : "turnos"} · ${formatPrice(total)}`}
          </p>
        </div>
        {day !== today && (
          <Link href="/admin" className="text-sm font-medium text-primary">
            Ir a hoy
          </Link>
        )}
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {visibleEntries.map((entry) => (
          <motion.li key={`${entry.kind}-${entry.start}-${"item" in entry ? entry.item.id : ""}`} layout initial={false}>
            {entry.kind === "appointment" && <AppointmentCard appointment={entry.item} data={data} />}
            {entry.kind === "block" && <BlockRow block={entry.item} timeZone={business.timeZone} />}
            {entry.kind === "free" && (
              <FreeRow
                start={entry.start}
                timeZone={business.timeZone}
                onAdd={() => setPreset({ mode: "appointment", day, time: formatTime(entry.start, business.timeZone) })}
                onBlock={() => setPreset({ mode: "block", day, time: formatTime(entry.start, business.timeZone) })}
              />
            )}
          </motion.li>
        ))}
      </ul>

      {cancelled.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowCancelled((v) => !v)}
            aria-expanded={showCancelled}
            className="w-full py-2 text-center text-sm text-muted hover:text-foreground"
          >
            {showCancelled ? "Ocultar" : "Ver"} cancelados ({cancelled.length})
          </button>
          {showCancelled && (
            <ul className="flex flex-col gap-2">
              {cancelled.map((entry) =>
                entry.kind === "appointment" ? (
                  <li key={entry.item.id}>
                    <AppointmentCard appointment={entry.item} data={data} />
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </div>
      )}

      {isClosedDay && (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Día cerrado. Si acordaste un turno especial, cargalo con el botón +.
        </p>
      )}

      <button
        type="button"
        onClick={() => setPreset({ mode: "appointment", day })}
        aria-label="Cargar turno o bloqueo"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-[max(1.25rem,calc(50%-14rem+1.25rem))] flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 transition hover:bg-primary-strong active:scale-95"
      >
        <Plus className="size-7" />
      </button>

      <NewEntrySheet business={business} preset={preset} onClose={() => setPreset(null)} />
    </>
  );
}

/* ---------- Semana ---------- */

function WeekStrip({ week, day, today }: { week: AgendaData["week"]; day: string; today: string }) {
  return (
    <nav className="mt-5 flex items-center gap-1" aria-label="Semana">
      <Link
        href={`/admin?dia=${addLocalDays(day, -7)}`}
        aria-label="Semana anterior"
        className="flex h-16 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface"
      >
        <ChevronLeft className="size-5" />
      </Link>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {week.map((d) => {
          const { weekday, day: num } = dayChipParts(d.date);
          const selected = d.date === day;
          return (
            <Link
              key={d.date}
              href={d.date === today ? "/admin" : `/admin?dia=${d.date}`}
              aria-current={selected ? "date" : undefined}
              className={`relative flex h-16 flex-col items-center justify-center rounded-xl border transition active:scale-95 ${
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface hover:border-primary/60"
              }`}
            >
              <span className="text-[10px] uppercase">{weekday}</span>
              <span className="text-base font-semibold leading-tight">{num}</span>
              {d.date === today && (
                <span className={`size-1 rounded-full ${selected ? "bg-primary-foreground" : "bg-primary"}`} aria-hidden />
              )}
              {d.count > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                  {d.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <Link
        href={`/admin?dia=${addLocalDays(day, 7)}`}
        aria-label="Semana siguiente"
        className="flex h-16 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface"
      >
        <ChevronRight className="size-5" />
      </Link>
    </nav>
  );
}

/* ---------- Turno ---------- */

const STATUS_BADGE: Partial<Record<AppointmentStatus, { label: string; className: string }>> = {
  ATTENDED: { label: "Asistió", className: "bg-accent/15 text-accent" },
  NO_SHOW: { label: "No vino", className: "bg-danger/15 text-danger" },
  LATE_CANCEL: { label: "Canceló tarde", className: "bg-danger/15 text-danger" },
  CANCELLED_BY_CUSTOMER: { label: "Canceló", className: "bg-surface-2 text-muted" },
  CANCELLED_BY_BUSINESS: { label: "Cancelado por vos", className: "bg-surface-2 text-muted" },
};

function AppointmentCard({ appointment: a, data }: { appointment: AgendaAppointment; data: AgendaData }) {
  const router = useRouter();
  const ctx = useMessageContext(data.business);
  const [menu, setMenu] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelledLink, setCancelledLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tz = data.business.timeZone;

  const cancelled = a.status === "CANCELLED_BY_CUSTOMER" || a.status === "CANCELLED_BY_BUSINESS";
  const isFuture = a.status === "CONFIRMED";
  const badge = STATUS_BADGE[a.status];
  const message = { customerName: a.customer.name, phone: a.customer.phone, serviceName: a.serviceName, startsAt: a.start, token: a.token };

  const run = (status: Parameters<typeof changeStatus>[1]) => {
    setError(null);
    startTransition(async () => {
      const result = await changeStatus(a.id, status);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (status === "CANCELLED_BY_BUSINESS") setCancelledLink(businessCancelLink(ctx, message));
      setMenu(false);
      setConfirmCancel(false);
      router.refresh();
    });
  };

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-surface ${
        cancelled ? "border-border/50 opacity-50" : a.type === "SPECIAL" ? "border-fuchsia-400/40" : "border-border"
      }`}
    >
      <div className="flex gap-3 p-3">
        <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/15 py-2 text-primary">
          <span className={`text-base font-semibold leading-none ${cancelled ? "line-through" : ""}`}>{formatTime(a.start, tz)}</span>
          <span className="mt-1 text-[10px] text-primary/70">{formatTime(a.end, tz)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold">{a.customer.name}</p>
            {badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.label}</span>}
          </div>
          <p className="text-sm text-muted">
            {a.serviceName}
            {a.people > 1 && ` · ${a.people} personas`} · {formatPrice(a.price)}
          </p>
          {a.address && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <Home className="size-3" aria-hidden /> {a.address}
            </p>
          )}
          {a.notes && <p className="mt-0.5 text-xs italic text-muted">“{a.notes}”</p>}
          {a.customerNoShows > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-danger">
              <UserX className="size-3" aria-hidden />
              {a.customerNoShows} {a.customerNoShows === 1 ? "falta" : "faltas"}
            </p>
          )}
        </div>
      </div>

      {!cancelled && (
        <div className="flex gap-2 border-t border-border px-3 py-2">
          {isFuture && (
            <a
              href={reminderLink(ctx, message)}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent/15 text-sm font-semibold text-accent transition active:scale-[0.98]"
            >
              <MessageCircle className="size-4" aria-hidden />
              Recordar
            </a>
          )}
          {(a.status === "NO_SHOW" || a.status === "LATE_CANCEL") && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run("ATTENDED")}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-2 text-sm font-medium"
            >
              <Undo2 className="size-4" aria-hidden />
              Deshacer
            </button>
          )}
          {(isFuture || a.status === "ATTENDED") && (
            <button
              type="button"
              onClick={() => {
                setMenu((m) => !m);
                setConfirmCancel(false);
              }}
              aria-expanded={menu}
              aria-label="Más acciones"
              className={`flex h-10 items-center justify-center rounded-lg px-3 ${isFuture ? "" : "flex-1 gap-1.5 text-sm"} bg-surface-2`}
            >
              <MoreHorizontal className="size-4" aria-hidden />
              {!isFuture && "Marcar falta"}
            </button>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {menu && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {confirmCancel ? (
              <div className="grid grid-cols-2 gap-2 border-t border-border px-3 py-2">
                <p className="col-span-2 text-center text-sm">¿Cancelar el turno de {a.customer.name.split(" ")[0]}?</p>
                <button type="button" onClick={() => setConfirmCancel(false)} className="h-10 rounded-lg bg-surface-2 text-sm">
                  No
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run("CANCELLED_BY_BUSINESS")}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-danger text-sm font-semibold text-white"
                >
                  {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Sí, cancelar
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 border-t border-border px-3 py-2">
                <MenuButton disabled={pending} onClick={() => run("NO_SHOW")}>No vino</MenuButton>
                <MenuButton disabled={pending} onClick={() => run("LATE_CANCEL")}>Canceló tarde</MenuButton>
                {isFuture ? (
                  <MenuButton disabled={pending} danger onClick={() => setConfirmCancel(true)}>
                    Cancelar
                  </MenuButton>
                ) : (
                  <span />
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {cancelledLink && (
        <a
          href={cancelledLink}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 border-t border-border bg-accent/10 py-2.5 text-sm font-semibold text-accent"
        >
          <MessageCircle className="size-4" aria-hidden />
          Avisarle por WhatsApp
        </a>
      )}
      {error && <p className="border-t border-border px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

function MenuButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-10 rounded-lg text-sm font-medium transition active:scale-[0.97] disabled:opacity-60 ${
        danger ? "bg-danger/15 text-danger" : "bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}

/* ---------- Hueco libre y bloqueo ---------- */

function FreeRow({
  start,
  timeZone,
  onAdd,
  onBlock,
}: {
  start: string;
  timeZone: string;
  onAdd: () => void;
  onBlock: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-3 py-2">
      <span className="w-14 text-center font-semibold text-muted">{formatTime(start, timeZone)}</span>
      <span className="flex-1 text-sm text-accent">Libre</span>
      <button
        type="button"
        onClick={onBlock}
        aria-label={`Bloquear las ${formatTime(start, timeZone)}`}
        className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface"
      >
        <Ban className="size-4" />
      </button>
      <button
        type="button"
        onClick={onAdd}
        className="flex h-10 items-center gap-1 rounded-lg bg-primary/15 px-3 text-sm font-semibold text-primary active:scale-95"
      >
        <Plus className="size-4" aria-hidden />
        Turno
      </button>
    </div>
  );
}

function BlockRow({ block, timeZone }: { block: AgendaBlock; timeZone: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const allDay = new Date(block.end).getTime() - new Date(block.start).getTime() >= 86_400_000;
  const remove = () =>
    startTransition(async () => {
      const result = await removeBlock(block.id);
      if (result.ok) router.refresh();
    });

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2/60 px-3 py-2 text-muted">
      <span className="w-14 text-center text-sm font-semibold">{allDay ? "—" : formatTime(block.start, timeZone)}</span>
      <span className="flex-1 text-sm">
        {allDay ? "Bloqueado todo el día" : `Bloqueado hasta ${formatTime(block.end, timeZone)}`}
        {block.reason && ` · ${block.reason}`}
      </span>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="flex h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-surface disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Quitar"}
      </button>
    </div>
  );
}
