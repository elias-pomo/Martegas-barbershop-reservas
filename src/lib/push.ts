import "server-only";
import webpush from "web-push";
import { db } from "./db";

export interface PushPayload {
  title: string;
  body: string;
  /** Adónde lleva tocar la notificación. */
  url?: string;
  /** Notificaciones con el mismo tag se reemplazan en vez de apilarse. */
  tag?: string;
}

let configured: boolean | null = null;

/** Las notificaciones son opcionales: sin claves VAPID, todo sigue funcionando sin avisos. */
export function pushEnabled(): boolean {
  if (configured === null) {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    configured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
    if (configured) webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
  }
  return configured;
}

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

export async function saveSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function deleteSubscription(userId: string, endpoint: string) {
  await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export async function hasSubscription(userId: string, endpoint: string) {
  return (await db.pushSubscription.count({ where: { userId, endpoint } })) > 0;
}

/**
 * Envía a todos los dispositivos de los usuarios del negocio. Las suscripciones vencidas
 * (el navegador las dio de baja) se borran. Nunca tira error: un aviso que falla no
 * puede romper una reserva.
 */
export async function notifyBusiness(businessId: string, payload: PushPayload): Promise<number> {
  if (!pushEnabled()) return 0;
  const subs = await db.pushSubscription.findMany({ where: { user: { businessId } } });
  const body = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
        TTL: 60 * 60 * 24,
        urgency: "high",
      }),
    ),
  );

  const expired = subs.filter((_, i) => {
    const r = results[i];
    return r.status === "rejected" && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0);
  });
  if (expired.length) await db.pushSubscription.deleteMany({ where: { id: { in: expired.map((s) => s.id) } } });

  for (const r of results) {
    if (r.status === "rejected" && ![404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)) {
      console.error("[push] error enviando notificación:", r.reason);
    }
  }
  return results.filter((r) => r.status === "fulfilled").length;
}
