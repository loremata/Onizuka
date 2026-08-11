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
    /**
     * I gesti che si fanno dal telefono, raggiungibili col tocco lungo
     * sull'icona. Puntano alla shell mobile `/admin/m`, non alle pagine
     * desktop: chi arriva da qui ha il telefono in mano per definizione.
     */
    shortcuts: [
      {
        name: "Registra inserimento",
        short_name: "Registra",
        description: "Registra una vendita del negozio",
        url: "/admin/m/registra",
      },
      {
        name: "Contatti in arrivo",
        short_name: "In arrivo",
        description: "Lead nuovi e avvisi da leggere",
        url: "/admin/m/lead",
      },
      {
        name: "Cerca cliente",
        short_name: "Cerca",
        description: "Cerca un cliente e apri la scheda essenziale",
        url: "/admin/m/cerca",
      },
      {
        name: "Prossime mosse",
        short_name: "Mosse",
        description: "Chi chiamare e perché",
        url: "/admin/m/mosse",
      },
    ],
  };
}
