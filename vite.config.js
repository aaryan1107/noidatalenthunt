import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(root, "index.html"),
        organiser: path.resolve(root, "organiser.html"),
        contact: path.resolve(root, "contact/index.html"),
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(root, "src") },
  },
});
