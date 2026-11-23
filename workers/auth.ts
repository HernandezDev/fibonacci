import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { oAuthProxy } from "better-auth/plugins/oauth-proxy";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { ac, roles } from "../app/shared/permisos";
import { esPais, esZonaHoraria, FORMATOS_HORA } from "../app/shared/regional";
import type { Db } from "./pg-client";
import * as schema from "./db";
import { editarPerfil } from "./validaciones/perfil";

// Login en las previews con `oauth-proxy`. Google no acepta comodines en las
// redirect URIs, así que la preview usa la de producción: producción canjea el
// código y le devuelve el perfil cifrado con OAUTH_PROXY_SECRET.
// - OAUTH_PROXY_SECRET (secreto): en producción y en las previews, el mismo
//   valor. Sin él no se carga el plugin (desarrollo local).
// - OAUTH_PROXY_PRODUCTION_URL (`previews.vars`): solo en las previews. Es lo
//   que activa el desvío; sin ella el plugin solo atiende la vuelta.
// No están en el `.env`, por eso no aparecen en el `Env` generado.
// Campo `picture` del `idToken` de Google, o `undefined` si no hay o no es una
// URL https. No se verifica la firma: el token lo guardó Better Auth al
// canjearlo con Google (o llegó cifrado por el proxy), no viene del navegador.
function fotoDelIdToken(idToken: string): string | undefined {
  try {
    const base64 = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { picture } = JSON.parse(atob(base64));
    return typeof picture === "string" && picture.startsWith("https://")
      ? picture
      : undefined;
  } catch {
    return undefined;
  }
}

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

// País y zona horaria del request según Cloudflare, ya validados. Solo los
// usa `/api/auth/*`, que es donde se crean usuarios y sesiones.
type DatosRegionales = { pais?: string; zonaHoraria?: string };

// Para `/api/auth/*`: deja en `c.var` el país y la zona horaria de Cloudflare,
// cada uno solo si es válido. País "XX" (Cloudflare no sabe), "T1" (Tor), vacío
// o cualquier otra cosa = `undefined`; lo mismo una zona que `Intl` no conoce o
// que no viene. En local los inventa Miniflare (o no vienen).
export const conDatosRegionales = createMiddleware<{
  Bindings: Env;
  Variables: DatosRegionales;
}>(async (c, next) => {
  const pais = c.req.raw.cf?.country;
  const zonaHoraria = c.req.raw.cf?.timezone;
  c.set("pais", esPais(pais) ? pais : undefined);
  c.set("zonaHoraria", esZonaHoraria(zonaHoraria) ? zonaHoraria : undefined);
  await next();
});

// Punto de entrada de `/api/auth/*`: atiende el request y corta cualquier
// redirección a un sitio que no sea este ni una preview.
export async function handleAuth(
  env: Env & ProxyEnv,
  db: Db,
  request: Request,
  regionales: DatosRegionales = {},
) {
  const response = await createAuth(env, db, regionales).handler(request);
  const location = response.headers.get("location");
  if (!location) return response;

  const origen = new URL(request.url);
  if (destinoPermitido(new URL(location, origen), origen)) return response;

  return Response.redirect(
    new URL("/api/auth/error?error=invalid_redirect", origen),
    302,
  );
}

// El cliente lo usa con `import type` para tipar los campos propios del usuario.
export type Auth = ReturnType<typeof createAuth>;

// Se crea por request, igual que el cliente `pg`: la conexión sale de `withDb`.
// `regionales` son el país y la zona de Cloudflare (`conDatosRegionales`), ya
// validados; solo los pasa `/api/auth/*`.
export function createAuth(
  env: Env & ProxyEnv,
  db: Db,
  { pais, zonaHoraria }: DatosRegionales = {},
) {
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
    user: {
      // `input: true`: el usuario los cambia desde el Perfil con
      // `authClient.updateUser`. Se validan en `databaseHooks.user.update`.
      additionalFields: {
        // ISO 3166-1 alfa-2 en mayúsculas ("AR"). `null` = sin dato.
        pais: { type: "string", required: false, input: true },
        // `null` = automático (ver `app/lib/locale.tsx`).
        formatoHora: {
          type: [...FORMATOS_HORA],
          required: false,
          input: true,
        },
        // Zona horaria IANA ("America/Argentina/Buenos_Aires"). Arranca con la
        // de Cloudflare y el usuario la cambia en el Perfil. `null` = sin dato.
        zonaHoraria: { type: "string", required: false, input: true },
      },
    },
    databaseHooks: {
      user: {
        // Cuenta nueva: el país y la zona de Cloudflare, cada uno solo si es
        // válido. Lo que falte queda en `null` y se completa al iniciar sesión.
        create: {
          before: async (usuario) => {
            if (!pais && !zonaHoraria) return;
            return {
              data: {
                ...usuario,
                ...(pais && { pais }),
                ...(zonaHoraria && { zonaHoraria }),
              },
            };
          },
        },
        // Cualquier cambio del usuario pasa por acá, venga del Perfil o de otro
        // endpoint de Better Auth. Se valida solo lo que llega.
        update: {
          before: async (cambios) => {
            const resultado = editarPerfil.safeParse(cambios);
            if (!resultado.success) {
              throw new APIError("BAD_REQUEST", {
                message: resultado.error.issues[0].message,
              });
            }
            return { data: { ...cambios, ...resultado.data } };
          },
        },
      },
      session: {
        // En cada inicio de sesión: completa el país y la zona que falten con
        // los de Cloudflare, en una sola consulta. Un valor ya guardado no se
        // pisa nunca: `COALESCE` conserva el actual y, si no falta ninguno, el
        // `WHERE` no toca la fila.
        create: {
          before: async (sesion) => {
            if (!pais && !zonaHoraria) return;
            await db
              .update(schema.user)
              .set({
                pais: sql`coalesce(${schema.user.pais}, ${pais ?? null})`,
                zonaHoraria: sql`coalesce(${schema.user.zonaHoraria}, ${zonaHoraria ?? null})`,
              })
              .where(
                and(
                  eq(schema.user.id, sesion.userId),
                  or(isNull(schema.user.pais), isNull(schema.user.zonaHoraria)),
                ),
              );
          },
        },
      },
      account: {
        // En cada inicio de sesión Better Auth guarda el `idToken` nuevo de
        // Google: de ahí sale la foto actual. Se actualiza solo `image`; el
        // nombre lo decide el usuario en el Perfil, por eso no se usa
        // `overrideUserInfoOnSignIn` (pisaría también `name`). Solo escribe si
        // la foto cambió.
        update: {
          after: async (cuenta) => {
            if (cuenta.providerId !== "google" || !cuenta.idToken) return;
            const foto = fotoDelIdToken(cuenta.idToken);
            if (!foto) return;
            await db
              .update(schema.user)
              .set({ image: foto })
              .where(
                and(
                  eq(schema.user.id, cuenta.userId),
                  sql`${schema.user.image} is distinct from ${foto}`,
                ),
              );
          },
        },
      },
    },
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
