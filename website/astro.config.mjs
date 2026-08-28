import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://kakomimasu.github.io",
  base: "/kakomi-code",
  vite: {
    plugins: [tailwindcss()],
  },
});
