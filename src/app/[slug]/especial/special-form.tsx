"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Home, Minus, MoonStar, Plus, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { waLink } from "@/lib/domain/whatsapp";
import { formatPrice } from "@/lib/format";
import { getSavedContact } from "@/lib/saved-appointments";

type Kind = "fuera" | "domicilio";

interface Props {
  slug: string;
  businessName: string;
  whatsapp: string;
  surchargePerPerson: number;
}

const inputClass =
  "mt-1.5 h-14 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none transition placeholder:text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/30";

export function SpecialRequestForm({ slug, businessName, whatsapp, surchargePerPerson }: Props) {
  const [kind, setKind] = useState<Kind>("fuera");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [people, setPeople] = useState(1);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [today, setToday] = useState<string>();

  useEffect(() => {
    const saved = getSavedContact()?.name;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura de localStorage tras montar
    if (saved) setName(saved);
    setToday(new Date().toLocaleDateString("en-CA"));
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const fecha = new Date(`${date}T12:00:00Z`).toLocaleDateString("es-AR", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const lines = [
      `Hola! Soy ${name.trim()}. Quería pedir un turno especial ${kind === "fuera" ? "fuera de horario" : "a domicilio"}:`,
      `• Día: ${fecha}`,
      `• Hora aproximada: ${time}`,
      `• Personas: ${people}`,
      ...(kind === "domicilio" ? [`• Dirección: ${address.trim()}`] : []),
      ...(notes.trim() ? [`• Comentario: ${notes.trim()}`] : []),
      "¿Tenés disponibilidad?",
    ];
    window.open(waLink(whatsapp, lines.join("\n")), "_blank", "noopener");
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <Link
        href={`/${slug}`}
        className="-ml-2 flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-foreground"
        aria-label="Volver al inicio"
      >
        <ArrowLeft className="size-5" />
      </Link>
      <h1 className="mt-4 font-display text-4xl leading-none tracking-wide">Turno especial</h1>
      <p className="mt-1 text-sm text-muted">
        Completá los datos y se abre WhatsApp con el mensaje listo para {businessName}. El precio se arregla por ahí.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de turno">
        <KindOption
          selected={kind === "fuera"}
          onSelect={() => setKind("fuera")}
          icon={<MoonStar className="size-5" />}
          title="Fuera de horario"
          detail={`+${formatPrice(surchargePerPerson)} por persona`}
        />
        <KindOption
          selected={kind === "domicilio"}
          onSelect={() => setKind("domicilio")}
          icon={<Home className="size-5" />}
          title="A domicilio"
          detail="Precio a convenir"
        />
      </div>

      <label className="mt-6 block">
        <span className="text-sm font-medium">Tu nombre</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" placeholder="Juan Pérez" className={inputClass} />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Día</span>
          <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Hora aprox.</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={inputClass} />
        </label>
      </div>

      <div className="mt-4">
        <span className="text-sm font-medium">¿Cuántas personas?</span>
        <div className="mt-1.5 flex h-14 items-center justify-between rounded-xl border border-border bg-surface px-2">
          <button type="button" onClick={() => setPeople((p) => Math.max(1, p - 1))} aria-label="Una persona menos" className="flex size-10 items-center justify-center rounded-lg hover:bg-surface-2 disabled:opacity-30" disabled={people <= 1}>
            <Minus className="size-4" />
          </button>
          <span className="text-lg font-semibold" aria-live="polite">{people}</span>
          <button type="button" onClick={() => setPeople((p) => Math.min(10, p + 1))} aria-label="Una persona más" className="flex size-10 items-center justify-center rounded-lg hover:bg-surface-2 disabled:opacity-30" disabled={people >= 10}>
            <Plus className="size-4" />
          </button>
        </div>
        {people > 1 && <p className="mt-1 text-xs text-muted">Los cortes se hacen uno tras otro.</p>}
      </div>

      <AnimatePresence initial={false}>
        {kind === "domicilio" && (
          <motion.label
            className="mt-4 block overflow-hidden"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <span className="text-sm font-medium">Dirección</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} required autoComplete="street-address" placeholder="Calle 123, barrio" className={inputClass} />
          </motion.label>
        )}
      </AnimatePresence>

      <label className="mt-4 block">
        <span className="text-sm font-medium">
          Comentario <span className="font-normal text-muted">(opcional)</span>
        </span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} placeholder="Ej: es para un cumpleaños" className={inputClass} />
      </label>

      <div className="mt-auto pt-8">
        <button
          type="submit"
          className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-lg font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition active:scale-[0.98]"
        >
          <Send className="size-5" aria-hidden />
          Enviar por WhatsApp
        </button>
      </div>
    </form>
  );
}

function KindOption({
  selected,
  onSelect,
  icon,
  title,
  detail,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex flex-col items-start rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
        selected ? "glow-purple border-primary bg-primary/15" : "border-border bg-surface hover:border-primary/50"
      }`}
    >
      <span className={selected ? "text-primary" : "text-muted"} aria-hidden>
        {icon}
      </span>
      <span className="mt-2 font-medium">{title}</span>
      <span className="text-xs text-muted">{detail}</span>
    </button>
  );
}
