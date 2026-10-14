import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // Build target: a standalone Node server in .output/ by default (Docker/OCI/Render), or a
    // Cloudflare Worker with NITRO_PRESET=cloudflare-module (see `npm run build:cloudflare`).
    ...(command === "build"
      ? [
          nitro({
            preset: process.env["NITRO_PRESET"] || "node-server",
            // wrangler.jsonc at the repo root is the single source of the Worker config
            cloudflare: { deployConfig: false, nodeCompat: true },
          }),
        ]
      : []),
    viteReact(),
  ],
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  // Pre-bundle the map libraries together, otherwise the lazily-loaded Leaflet plugin
  // can end up with a different Leaflet chunk than the map in dev mode.
  optimizeDeps: { include: ["leaflet", "maplibre-gl", "@maplibre/maplibre-gl-leaflet"] },
  server: {
    port: 3000,
    // Per provarla sul telefono con un tunnel HTTPS (vedi README): `npx cloudflared tunnel --url http://localhost:3000`
    allowedHosts: [".trycloudflare.com"],
  },
}));
