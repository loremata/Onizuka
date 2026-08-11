self.addEventListener("push", (event) => {
  let data = { title: "Onizuka", body: "" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Onizuka", {
      body: data.body || "",
      // Era "/favicon.ico", che in produzione risponde 404 da sempre:
      // le icone vere sono arrivate col manifest PWA.
      icon: "/icons/icon-192.png",
    })
  );
});
