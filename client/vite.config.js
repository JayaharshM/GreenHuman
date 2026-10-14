import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const apiTarget = process.env.VITE_DEV_API_TARGET || "http://127.0.0.1:4000";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": apiTarget,
      "/socket.io": { target: apiTarget, ws: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          motion: ["framer-motion"],
          vendor: ["react", "react-dom", "react-router-dom"],
          maps: ["leaflet", "react-leaflet"],
        },
      },
    },
  },
});
