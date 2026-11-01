import { defineConfig } from "drizzle-kit";

// `.env` es opcional: en CI la variable viene del entorno.
try {
  process.loadEnvFile();
} catch {}

// DATABASE_URL es la cadena DIRECTA de Neon (sin -pooler), nunca la de Hyperdrive.
export default defineConfig({
  dialect: "postgresql",
  schema: "./workers/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
