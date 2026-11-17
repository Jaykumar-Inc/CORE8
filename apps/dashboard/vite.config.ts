import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { hardwareDiscovery } from "./hardware-discovery.mjs";
export default defineConfig({
  plugins: [react(), tailwindcss(), hardwareDiscovery()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          motion: ["motion/react"],
          validation: ["zod"],
        },
      },
    },
  },
});
