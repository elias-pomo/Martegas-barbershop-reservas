import { Share, SquarePlus } from "lucide-react";

/** Pasos para instalar el panel en iPhone (Safari). Sin instalar, iOS no permite avisos. */
export function InstallSteps() {
  return (
    <ol className="flex flex-col gap-2 text-sm">
      <li className="flex items-center gap-2">
        <Step n={1} />
        Abrí esta página en <span className="font-semibold">Safari</span>.
      </li>
      <li className="flex items-center gap-2">
        <Step n={2} />
        Tocá <Share className="size-4 text-primary" aria-label="Compartir" /> <span className="font-semibold">Compartir</span>.
      </li>
      <li className="flex items-center gap-2">
        <Step n={3} />
        Elegí <SquarePlus className="size-4 text-primary" aria-hidden />
        <span className="font-semibold">Agregar a inicio</span>.
      </li>
      <li className="flex items-center gap-2">
        <Step n={4} />
        Abrí <span className="font-semibold">Agenda</span> desde el ícono nuevo.
      </li>
    </ol>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
      {n}
    </span>
  );
}
