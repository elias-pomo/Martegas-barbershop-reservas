"use client";

import { BellRing, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { isIOS, isStandalone } from "./device";

const DISMISS_KEY = "agendapp:panel:install-banner";

/** En iPhone sin instalar, recuerda que instalando el panel llegan los avisos. Se puede cerrar. */
export function InstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // sin almacenamiento
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende del dispositivo, solo se sabe en el navegador
    setShow(!dismissed && isIOS() && !isStandalone());
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sin almacenamiento
    }
  };

  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-3">
      <BellRing className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <p className="flex-1 text-sm">
        Instalá el panel en tu iPhone para recibir un aviso con cada turno.{" "}
        <Link href="/admin/ajustes" className="font-semibold text-primary">
          Ver cómo
        </Link>
      </p>
      <button type="button" onClick={dismiss} aria-label="Cerrar" className="text-muted hover:text-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
}
