import { connection } from "next/server";
import { getOpenStatus } from "@/lib/booking";
import { opensLabel } from "@/lib/domain/open-status";

/** Cartel "Abierto / Cerrado" bajo el nombre, como el de una vidriera. Depende de la hora: va en Suspense. */
export async function OpenBadge({ slug }: { slug: string }) {
  await connection();
  const now = new Date();
  const result = await getOpenStatus(slug, now);
  if (!result) return null;
  const { status, timeZone } = result;

  if (status.open) {
    return (
      <p className="mt-4 inline-flex items-center gap-2 text-sm">
        <span className="relative flex size-2.5" aria-hidden>
          <span className="absolute inline-flex size-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
        </span>
        <span className="neon-text-green font-semibold">Abierto ahora</span>
        <span className="text-muted">· último turno {status.lastStart}</span>
      </p>
    );
  }

  return (
    <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
      <span className="size-2.5 rounded-full bg-muted/40" aria-hidden />
      <span className="font-semibold text-foreground/80">Cerrado</span>
      {status.opensAt && <span>· {opensLabel(status.opensAt, now, timeZone)}</span>}
    </p>
  );
}

export function OpenBadgeSkeleton() {
  return <span className="barber-skeleton mt-4 inline-block h-5 w-56 rounded-full bg-surface" aria-hidden />;
}
