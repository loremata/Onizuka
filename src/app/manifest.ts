import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Onizuka",
    short_name: "Onizuka",
    description: "Sistema operativo intelligente per clienti e operazioni",
    start_url: "/admin",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: "it",
  };
}
