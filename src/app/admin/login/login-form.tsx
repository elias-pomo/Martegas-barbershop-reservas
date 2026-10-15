"use client";

import { Loader2, LogIn } from "lucide-react";
import { useActionState } from "react";
import { login } from "./actions";

const inputClass =
  "mt-1.5 h-14 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);

  return (
    <form action={action} className="mt-10 flex flex-col gap-4">
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          key={state?.email}
          defaultValue={state?.email}
          name="email"
          type="email"
          required
          autoComplete="username"
          inputMode="email"
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Contraseña</span>
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </label>
      {state?.error && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground transition hover:bg-primary-strong active:scale-[0.98] disabled:opacity-70"
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <LogIn className="size-5" aria-hidden />}
        Ingresar
      </button>
    </form>
  );
}
