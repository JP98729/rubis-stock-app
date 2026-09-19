import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rubis Enjoy — Stock & Reorder",
    short_name: "Rubis Enjoy",
    description: "Stock counts, reorders and branch messaging for Rubis Enjoy. Supplied by Pure Nutrition.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#6DBE00",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
