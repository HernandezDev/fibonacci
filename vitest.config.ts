import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Configuración de las pruebas. Va APARTE de vite.config.ts a propósito: ese
// archivo carga los plugins de Cloudflare, React Router y Panda, pensados para
// construir la app y el Worker, no para correr pruebas en Node.
export default defineConfig({
  resolve: {
    alias: {
      // "~/lib/calendario" apunta a app/lib/calendario (mismo alias que en tsconfig.cloudflare.json).
      "~": fileURLToPath(new URL("./app", import.meta.url)),
      // "styled-system/css" apunta al código que genera `panda codegen`.
      "styled-system": fileURLToPath(new URL("./styled-system", import.meta.url)),
    },
  },
  test: {
    environment: "node", // sin navegador simulado: los componentes se prueban renderizándolos a texto HTML
    include: ["app/**/*.test.{ts,tsx}"], // las pruebas viven junto a lo que prueban: algo.ts → algo.test.ts
  },
});