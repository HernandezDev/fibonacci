import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { oAuthProxy } from "better-auth/plugins/oauth-proxy";

import { ac, roles } from "../app/lib/permisos";
import type { Db } from "./pg-client";
import * as schema from "./db";

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
const PREVIEW_SUFFIX = "-fibonacci.josuehernandezrivas.workers.dev";
const PREVIEW_HOSTS = `*${PREVIEW_SUFFIX}`;

// Endpoints del plugin que reciben el perfil cifrado y crean la sesión. Solo
// los necesitan las previews. En producción se cierran: si no, quien tenga
// OAUTH_PROXY_SECRET (cualquier código que corra en una preview puede leerlo)
// podría armar un perfil con el email de otro y entrar como esa persona.
// Son rutas ya resueltas por Better Auth, así que ninguna variante de la URL
// las esquiva.
const RECEPCION_PROXY = ["/callback/:id/oauth-proxy", "/oauth-proxy-callback"];

// Better Auth solo redirige al mismo sitio o a Google (el inicio de sesión
// manda un header `Location` hacia Google, además del JSON), salvo el proxy, que
// manda el perfil cifrado a una preview. La URL de ese envío sale del `state`,
// y quien tenga OAUTH_PROXY_SECRET puede armar uno con cualquier destino: así se
// llevaría el perfil de Google de quien abra el enlace. Por eso se valida el
// destino real.
const GOOGLE_OAUTH_ORIGIN = "https://accounts.google.com";

export function destinoPermitido(destino: URL, origen: URL) {
  if (destino.origin === origen.origin) return true;
  if (destino.origin === GOOGLE_OAUTH_ORIGIN) return true;
  return (
    destino.protocol === "https:" && destino.hostname.endsWith(PREVIEW_SUFFIX)
  );
}

// Punto de entrada de `/api/auth/*`: atiende el request y corta cualquier
// redirección a un sitio que no sea este ni una preview.
export async function handleAuth(
  env: Env & ProxyEnv,
  db: Db,
  request: Request,
) {
  const response = await createAuth(env, db).handler(request);
  const location = response.headers.get("location");
  if (!location) return response;

  const origen = new URL(request.url);
  if (destinoPermitido(new URL(location, origen), origen)) return response;

  return Response.redirect(
    new URL("/api/auth/error?error=invalid_redirect", origen),
    302,
  );
}

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
    hooks: {
      // Sin OAUTH_PROXY_PRODUCTION_URL no es una preview: producción (por el
      // dominio o por `workers.dev`) o local.
      before: createAuthMiddleware(async (ctx) => {
        if (!productionURL && RECEPCION_PROXY.includes(ctx.path)) {
          throw new APIError("NOT_FOUND");
        }
      }),
    },
    plugins: [
      admin({ ac, roles, defaultRole: "alumno", adminRoles: ["admin"] }),
      ...(proxySecret
        ? [oAuthProxy({ secret: proxySecret, productionURL })]
        : []),
    ],
  });
}
