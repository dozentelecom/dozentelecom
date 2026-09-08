import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dozentelecom",
    short_name: "Dozentelecom",
    description: "Secure Nigerian VTU wallet and digital services",
    start_url: "/",
    display: "standalone",
    background_color: "#06111f",
    theme_color: "#c90000",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}