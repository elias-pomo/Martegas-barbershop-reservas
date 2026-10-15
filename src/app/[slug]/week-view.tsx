"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import type { SlotState } from "@/lib/domain/availability";
import { dayChipParts, formatTime } from "@/lib/format";

export interface WeekViewDay {
  date: string;
  open: boolean;
  slots: { start: string; state: SlotState }[];
}

interface Props {
  slug: string;
  timeZone: string;
  today: string;
  days: WeekViewDay[];
}

const SLOT_STYLE: Record<SlotState, string> = {
  free: "border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 active:scale-95",
  busy: "border-primary/25 bg-primary/10 text-primary/70",
  past: "border-transparent bg-surface/50 text-muted/40 line-through",
};

const SLOT_LABEL: Record<SlotState, string> = { free: "libre", busy: "ocupado", past: "pasado" };

function initialDay(days: WeekViewDay[], today: string): string {
  const hasFree = (d: WeekViewDay) => d.slots.some((s) => s.state === "free");
  const todayDay = days.find((d) => d.date === today);
  if (todayDay && hasFree(todayDay)) return today;
  return days.find((d) => d.date >= today && hasFree(d))?.date ?? today;
}

export function WeekView({ slug, timeZone, today, days }: Props) {
  const [selected, setSelected] = useState(() => initialDay(days, today));
  const day = days.find((d) => d.date === selected);

  return (
    <section className="mt-10" aria-labelledby="semana">
      <div className="flex items-baseline justify-between">
        <h2 id="semana" className="text-sm font-medium uppercase tracking-widest text-muted">
          Esta semana
        </h2>
        <ul className="flex gap-3 text-[11px] text-muted">
          <li className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-accent" aria-hidden /> Libre
          </li>
          <li className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-primary/70" aria-hidden /> Ocupado
          </li>
        </ul>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const { weekday, day: num } = dayChipParts(d.date);
          const free = d.slots.filter((s) => s.state === "free").length;
          const isSelected = d.date === selected;
          const isPast = d.date < today;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => setSelected(d.date)}
              aria-pressed={isSelected}
              aria-label={`${weekday} ${num}: ${d.open ? `${free} turnos libres` : "cerrado"}`}
              className={`relative flex flex-col items-center rounded-xl border py-2 transition active:scale-95 ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : isPast || !d.open
                    ? "border-transparent bg-surface/40 text-muted/50"
                    : "border-border bg-surface hover:border-primary/60"
              }`}
            >
              <span className="text-[10px] uppercase">{weekday}</span>
              <span className="text-base font-semibold leading-tight">{num}</span>
              {d.date === today && (
                <span className={`mt-0.5 size-1 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-primary"}`} aria-hidden />
              )}
              {free > 0 && !isSelected && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                  {free}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={selected}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="mt-3 rounded-2xl border border-border bg-surface p-3"
        >
          {!day?.open ? (
            <p className="py-4 text-center text-sm text-muted">Cerrado</p>
          ) : (
            <ul className="grid grid-cols-4 gap-1.5">
              {day.slots.map((slot) => {
                const time = formatTime(slot.start, timeZone);
                const className = `flex h-11 items-center justify-center rounded-lg border text-sm font-semibold transition ${SLOT_STYLE[slot.state]}`;
                return (
                  <li key={slot.start}>
                    {slot.state === "free" ? (
                      <Link
                        href={`/${slug}/reservar?hora=${encodeURIComponent(slot.start)}`}
                        className={className}
                        aria-label={`${time}, libre: reservar`}
                      >
                        {time}
                      </Link>
                    ) : (
                      <span className={className} aria-label={`${time}, ${SLOT_LABEL[slot.state]}`}>
                        {time}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

export function WeekViewSkeleton() {
  return (
    <div className="mt-10 animate-pulse" aria-label="Cargando la semana">
      <div className="h-4 w-28 rounded bg-surface" />
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-[58px] rounded-xl bg-surface" />
        ))}
      </div>
      <div className="mt-3 h-[106px] rounded-2xl bg-surface" />
    </div>
  );
}
