"use client";

import { Check, Loader2, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateCustomerName } from "../../../actions";

/** Nombre del cliente con edición en el lugar (para corregir cómo lo escribió al reservar). */
export function RenameCustomer({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="group flex max-w-full items-center gap-2 text-left">
        <h1 className="truncate text-xl font-semibold">{name}</h1>
        <Pencil className="size-3.5 shrink-0 text-muted group-hover:text-foreground" aria-label="Editar nombre" />
      </button>
    );
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateCustomerName(id, value);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <form onSubmit={save}>
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          minLength={2}
          maxLength={60}
          aria-label="Nombre del cliente"
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-base outline-none focus:border-primary"
        />
        <button type="submit" disabled={pending} aria-label="Guardar" className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </button>
        <button
          type="button"
          aria-label="Cancelar"
          onClick={() => {
            setValue(name);
            setEditing(false);
          }}
          className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-surface"
        >
          <X className="size-4" />
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </form>
  );
}
