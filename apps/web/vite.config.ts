import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// React talks ONLY to the Node.js API (never Oracle/ORDS/Fusion directly).
// The dev proxy below forwards /api to the API server so the browser only
// ever sees same-origin requests during local development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
