"use client";

import { Bell, BellOff, BellRing, Loader2, Send } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { isPushRegistered, sendTestPush, subscribePush, unsubscribePush } from "../../actions";
import { isIOS, isStandalone, pushSupported, urlBase64ToUint8Array } from "../../device";
import { InstallSteps } from "../../install-steps";

type State =
  | "checking"
  | "not-configured"
  | "install-first"
  | "unsupported"
  | "denied"
  | "off"
  | "on";

/** Activar/desactivar los avisos de turnos en ESTE dispositivo. */
export function NotificationsPanel({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const detect = async (): Promise<State> => {
      if (!vapidKey) return "not-configured";
      if (isIOS() && !isStandalone()) return "install-first";
      if (!pushSupported()) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return "off";
      // Puede existir en el navegador pero no en el servidor (p. ej. se cambió la contraseña o la base).
      return (await isPushRegistered(subscription.endpoint)) ? "on" : "off";
    };
    detect()
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  const enable = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        // El pedido de permiso tiene que salir directo del toque del usuario (requisito de iOS).
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey!),
          }));
        const result = await subscribePush(subscription.toJSON());
        if (!result.ok) throw new Error(result.message);
        setState("on");
        setMessage({ ok: true, text: "Listo: te vamos a avisar de cada turno nuevo o cancelado." });
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "No se pudieron activar los avisos." });
      }
    });

  const disable = () =>
    startTransition(async () => {
      setMessage(null);
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    });

  const test = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await sendTestPush();
      setMessage(result.ok ? { ok: true, text: "Enviada. Debería llegarte en unos segundos." } : { ok: false, text: result.message });
    });

  return (
    <div>
      {state === "checking" && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Revisando…</p>}

      {state === "not-configured" && (
        <p className="text-sm text-muted">Los avisos todavía no están configurados en el servidor (faltan las claves VAPID).</p>
      )}

      {state === "install-first" && (
        <div>
          <p className="mb-3 text-sm">
            En iPhone los avisos solo funcionan con el panel <span className="font-semibold">instalado en la pantalla de inicio</span>:
          </p>
          <InstallSteps />
          <p className="mt-3 text-xs text-muted">Después volvé a Ajustes desde la app instalada y activá los avisos.</p>
        </div>
      )}

      {state === "unsupported" && <p className="text-sm text-muted">Este navegador no permite notificaciones. Probá con Safari (iPhone) o Chrome (Android).</p>}

      {state === "denied" && (
        <p className="text-sm text-muted">
          Los avisos están bloqueados para esta app. Activalos desde <span className="font-semibold">Configuración → Notificaciones → Agenda</span> y volvé a abrir la app.
        </p>
      )}

      {state === "off" && (
        <>
          <p className="text-sm text-muted">Recibí un aviso en este celular cada vez que alguien reserva o cancela un turno.</p>
          <button
            type="button"
            onClick={enable}
            disabled={pending}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-70"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Bell className="size-4" aria-hidden />}
            Activar avisos
          </button>
        </>
      )}

      {state === "on" && (
        <>
          <p className="flex items-center gap-2 text-sm font-medium text-accent">
            <BellRing className="size-4" aria-hidden />
            Avisos activados en este dispositivo
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={test}
              disabled={pending}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent/15 text-sm font-semibold text-accent disabled:opacity-70"
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
              Probar
            </button>
            <button
              type="button"
              onClick={disable}
              disabled={pending}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-medium text-muted disabled:opacity-70"
            >
              <BellOff className="size-4" aria-hidden />
              Desactivar
            </button>
          </div>
        </>
      )}

      {message && (
        <p role="status" className={`mt-3 text-sm ${message.ok ? "text-accent" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
