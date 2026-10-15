/**
 * Ícono por servicio, con los mismos dibujos del fondo (public/fondo-barberia.svg):
 * barba / afeitado → navaja; máquina / degradé / rapado → máquina; el resto → tijera.
 * Se elige por el nombre, así sirve para cualquier negocio sin configurar nada.
 */
type Kind = "tijera" | "navaja" | "maquina";

export function serviceKind(name: string): Kind {
  const n = name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if (/barba|afeit|navaja/.test(n)) return "navaja";
  if (/maquina|degrad|fade|rapad/.test(n)) return "maquina";
  return "tijera";
}

const PATHS: Record<Kind, React.ReactNode> = {
  tijera: (
    <>
      <path d="M36 66 L64 6 Q62 30 46 60 Z" />
      <path d="M64 66 L36 6 Q38 30 54 60 Z" />
      <circle cx="50" cy="44" r="3" />
      <circle cx="30" cy="78" r="12" />
      <circle cx="70" cy="78" r="12" />
    </>
  ),
  navaja: (
    <>
      <path d="M8 60 Q8 52 16 52 H56 Q60 52 60 56 V60 Q60 64 56 64 H16 Q8 64 8 60 Z" />
      <circle cx="16" cy="58" r="2" />
      <circle cx="52" cy="58" r="2" />
      <path d="M58 54 L64 40 H90 Q96 40 96 46 V48 Q96 52 92 52 H64" />
      <path d="M66 47 H90" />
    </>
  ),
  maquina: (
    <>
      <path d="M32 30 Q32 10 50 10 Q68 10 68 30 L66 72 H34 Z" />
      <rect x="30" y="72" width="40" height="8" rx="2" />
      <path d="M34 80v8M42 80v8M50 80v8M58 80v8M66 80v8" />
      <rect x="45" y="24" width="10" height="20" rx="5" />
    </>
  ),
};

export function ServiceIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[serviceKind(name)]}
    </svg>
  );
}
