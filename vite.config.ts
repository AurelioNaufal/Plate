import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// BASE is set by the GitHub Pages workflow to "/<repo-name>/".
export default defineConfig({
  base: process.env.BASE ?? "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Plate",
        short_name: "Plate",
        description: "Money, meals and gym in one place",
        theme_color: "#1D5FD6",
        background_color: "#F4F5F7",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // Precache the app shell only; API calls always go to the network (online-only).
      workbox: { globPatterns: ["**/*.{js,css,html,png,svg}"], runtimeCaching: [] },
    }),
  ],
});
