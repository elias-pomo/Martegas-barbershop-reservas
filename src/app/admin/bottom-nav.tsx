"use client";

import { CalendarDays, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Agenda", icon: CalendarDays, match: (p: string) => p === "/admin" },
  { href: "/admin/clientes", label: "Clientes", icon: Users, match: (p: string) => p.startsWith("/admin/clientes") },
  { href: "/admin/ajustes", label: "Ajustes", icon: Settings, match: (p: string) => p.startsWith("/admin/ajustes") },
];

/** Barra con la sección activa resaltada. Lee la URL: va dentro de <Suspense> con `BottomNavShell` de fallback. */
export function BottomNav() {
  return <BottomNavShell pathname={usePathname()} />;
}

/** La misma barra sin depender de la URL (se prerenderiza en el shell estático). */
export function BottomNavShell({ pathname }: { pathname?: string }) {
  return (
    <nav
      aria-label="Panel"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-3">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = pathname ? match(pathname) : false;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition ${
                  active ? "text-primary" : "text-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
