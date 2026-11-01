import { defineConfig } from "drizzle-kit";

import base from "./drizzle.config";

// Igual que `drizzle.config.ts`, pero apunta a la rama `production`.
// PROD_DATABASE_URL es la cadena DIRECTA (sin -pooler) de esa rama.
export default defineConfig({
  ...base,
  dbCredentials: { url: process.env.PROD_DATABASE_URL! },
});
