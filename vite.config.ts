import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  publicDir: "node_modules/monaco-editor/min",
  build: {
    outDir: "dist",
  },
});
