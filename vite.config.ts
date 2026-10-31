import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import pandacss from "@pandacss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    pandacss(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
