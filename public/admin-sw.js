/**
 * Service worker delle notifiche admin. Nessuna cache offline: fa una cosa
 * sola, mostrare la notifica e portarti dove serve al tocco.
 */
self.addEventListener("push", (event) => {
  let data = { title: "Onizuka", body: "", url: "/admin/m/lead" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* payload non JSON: restano i valori di default */
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Onizuka", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Stesso tag = una notifica sostituisce la precedente invece di
      // impilarne dieci quando entrano piu' contatti di fila.
      tag: "onizuka-lead",
      renotify: true,
      data: { url: data.url || "/admin/m/lead" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/admin/m/lead";

  // Se l'app e' gia' aperta la porto in primo piano invece di aprire una
  // seconda finestra: su telefono due istanze della stessa app confondono.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/admin") && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
