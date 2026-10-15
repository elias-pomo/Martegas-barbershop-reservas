// Service worker de Agendapp: solo notificaciones push (no cachea nada, la app no funciona offline).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Agendapp", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Agendapp", {
      body: data.body || "",
      icon: "/api/icon?size=192&text=A",
      badge: "/api/icon?size=96&text=A&badge=1",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/admin", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Si el panel ya está abierto, se reutiliza esa ventana.
      for (const client of windows) {
        if (new URL(client.url).pathname.startsWith("/admin") && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
