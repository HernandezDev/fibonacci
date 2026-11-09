import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { oAuthProxy } from "better-auth/plugins/oauth-proxy";

import { ac, roles } from "../app/lib/permisos";
import type { Db } from "./db/client";
import * as schema from "./db/schema";

// Login en las previews con `oauth-proxy`. Google no acepta comodines en las
// redirect URIs, así que la preview usa la de producción: producción canjea el
// código y le devuelve el perfil cifrado con OAUTH_PROXY_SECRET.
// - OAUTH_PROXY_SECRET (secreto): en producción y en las previews, el mismo
//   valor. Sin él no se carga el plugin (desarrollo local).
// - OAUTH_PROXY_PRODUCTION_URL (`previews.vars`): solo en las previews. Es lo
//   que activa el desvío; sin ella el plugin solo atiende la vuelta.
// No están en el `.env`, por eso no aparecen en el `Env` generado.
type ProxyEnv = {
  OAUTH_PROXY_SECRET?: string;
  OAUTH_PROXY_PRODUCTION_URL?: string;
};

// Previews de este Worker: por rama (`feat-x-fibonacci...`) y por deploy
// (`06c36878-fibonacci...`). No incluye el `workers.dev` de producción.
const PREVIEW_HOSTS = "*-fibonacci.josuehernandezrivas.workers.dev";

// Se crea por request, igual que el cliente `pg`: la conexión sale de `withDb`.
export function createAuth(env: Env & ProxyEnv, db: Db) {
  const proxySecret = env.OAUTH_PROXY_SECRET;
  const productionURL = env.OAUTH_PROXY_PRODUCTION_URL;

  return betterAuth({
    appName: "Instituto Fibonacci",
    // La URL base sale del host de cada request, solo si está en esta lista.
    // Las previews se suman solo dentro de una preview.
    baseURL: {
      allowedHosts: [
        "fibonacci.com.ar",
        "fibonacci.josuehernandezrivas.workers.dev",
        "localhost:5173",
        ...(productionURL ? [PREVIEW_HOSTS] : []),
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
      ...(proxySecret
        ? [oAuthProxy({ secret: proxySecret, productionURL })]
        : []),
    ],
  });
}
