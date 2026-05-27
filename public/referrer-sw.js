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
      icon: "/favicon.ico",
    })
  );
});
