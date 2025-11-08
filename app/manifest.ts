import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crypto Trading Journal",
    short_name: "Trading Journal",
    description:
      "Track your crypto executions, notes, and performance analytics anywhere.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#1380d6",
    lang: "en",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
