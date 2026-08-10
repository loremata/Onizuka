import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Onizuka",
    short_name: "Onizuka",
    description: "Sistema operativo intelligente per clienti e operazioni",
    /** `id` esplicito ma identico allo start_url di prima: l'app installata resta la stessa. */
    id: "/admin",
    start_url: "/admin",
    /**
     * Senza `scope` verrebbe dedotto da start_url (`/admin/`) e il redirect a
     * `/login` uscirebbe dalla finestra standalone aprendo il browser.
     */
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    /** Allineati alla shell chiara: --background #F8FAFC, header bg-card bianco. */
    background_color: "#F8FAFC",
    theme_color: "#FFFFFF",
    lang: "it",
    dir: "ltr",
    orientation: "any",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    /** I gesti che si fanno dal telefono, raggiungibili col tocco lungo sull'icona. */
    shortcuts: [
      {
        name: "Registra inserimento",
        short_name: "Registra",
        description: "Registra una vendita del negozio",
        url: "/admin/inserimenti/registra",
      },
      {
        name: "Nuovo lead",
        short_name: "Lead",
        description: "Inserimento veloce di un contatto",
        url: "/admin/crm/leads/quick",
      },
      {
        name: "Cerca",
        short_name: "Cerca",
        description: "Cerca un cliente o un contatto",
        url: "/admin/search",
      },
      {
        name: "Notifiche",
        short_name: "Notifiche",
        description: "Lead in arrivo e avvisi",
        url: "/admin/notifications",
      },
    ],
  };
}
