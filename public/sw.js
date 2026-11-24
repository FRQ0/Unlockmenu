// Service worker dos painéis (PWA): recebe push e abre o painel ao tocar.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Novo chamado" }; }
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/app/garcom";
  event.waitUntil(
    self.registration.showNotification(data.title || "Novo chamado", {
      body: data.body || "",
      tag: data.tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 300],
      icon: "/brand/icon-192.png",
      badge: "/brand/icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app/garcom";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.includes("/app") && "focus" in c) { c.navigate(url); return c.focus(); }
      return self.clients.openWindow(url);
    }),
  );
});

// Sem cache offline de dados: o painel precisa sempre do estado real do salão.
self.addEventListener("fetch", () => {});
