import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";

import { ac, roles } from "../app/lib/permisos";
import type { Db } from "./db/client";
import * as schema from "./db/schema";

// Se crea por request, igual que el cliente `pg`: la conexión sale de `withDb`.
export function createAuth(env: Env, db: Db) {
  return betterAuth({
    appName: "Instituto Fibonacci",
    // La URL base sale del host de cada request, solo si está en esta lista.
    // Las previews no están: Google no acepta comodines en las redirect URIs.
    baseURL: {
      allowedHosts: [
        "fibonacci.com.ar",
        "fibonacci.josuehernandezrivas.workers.dev",
        "localhost:5173",
      ],
    },
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // Deja elegir cuenta aunque haya una sola sesión de Google abierta.
        prompt: "select_account",
      },
    },
    // En Workers la memoria no se comparte entre instancias: el rate limit va a
    // la base (etapa 1). Por defecto Better Auth lo activa solo si
    // `NODE_ENV === "production"`, y en el Worker `NODE_ENV` no existe: sin
    // `enabled: true` queda apagado también en producción.
    rateLimit: { enabled: true, storage: "database" },
    advanced: {
      database: { generateId: "uuid" },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    plugins: [
      admin({ ac, roles, defaultRole: "alumno", adminRoles: ["admin"] }),
    ],
  });
}
