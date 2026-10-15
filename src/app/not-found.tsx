import { SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-surface text-muted">
        <SearchX className="size-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold">No encontramos lo que buscabas</h1>
      <p className="mt-1 text-sm text-muted">El link puede estar mal copiado o el turno ya no existe.</p>
      <Link
        href="/"
        className="mt-6 flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground"
      >
        Ir al inicio
      </Link>
    </main>
  );
}
