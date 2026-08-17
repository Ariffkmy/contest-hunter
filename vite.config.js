import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Contest Hunter",
        short_name: "ContestHunt",
        description:
          "Track Malaysian Instagram giveaways, manage entries, and get answer ideas.",
        theme_color: "#173f46",
        background_color: "#f6f4ef",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        // App is auth-gated + Supabase-backed; network-first keeps data fresh,
        // with runtime caching for static assets only.
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/segbjjafofbxqgxfpuje\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 }
            }
          }
        ]
      }
    })
  ]
});
