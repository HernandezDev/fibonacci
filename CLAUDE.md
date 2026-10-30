# Fibonacci (3.er intento)

Sistema de reserva de turnos para clases particulares de matemática (Instituto Fibonacci, `fibonacci.com.ar`). Es el emprendimiento del papá de Josué, con la idea de poder sumar otros profesores. Es el **3.er intento, desde cero**.

> Reemplazá `<nombre-del-repo>` donde aparezca. El nombre todavía no está elegido (propuesta: `fibonacci`).

## Prioridades

- **Confiabilidad y mantenibilidad** por encima de todo. Preferir lo aburrido y probado.
- **Erasable syntax**: TypeScript es una capa puramente estática. Nada de enums, namespaces ni parameter properties. React/Preact (JSX) sí, Svelte no.
- Que otros puedan colaborar: **npm** (no pnpm), un solo `package-lock.json`.

## Stack

| Capa | Decisión |
|---|---|
| Hosting | Cloudflare Workers + Static Assets, un solo Worker |
| Framework | React Router 8.x modo framework (plantilla oficial de Cloudflare) |
| Rendering | `ssr: false` + `prerender: ["/"]`: landing prerenderizada, resto SPA |
| API | Hono montado en `workers/app.ts` bajo `/api/*`, con Hono RPC |
| Validación | Zod (`@hono/zod-validator`), esquemas compartidos con el frontend |
| DB | Postgres en Neon, vía Hyperdrive |
| ORM | Drizzle con driver `pg` (Postgres.js no está soportado en Hyperdrive) |
| Auth | Better Auth |
| Datos en el cliente | Etapa 1: route modules de React Router (`default` + `clientLoader` + `clientAction`), sin Zustand ni TanStack Query |
| Rate limit / sesiones | Etapa 1: en la base de datos (Neon). **Etapa 2:** Upstash Redis (cuenta de Upstash aparte de la de LALIsta) |
| CSS | Panda CSS, integrado con el plugin de Vite (ver "Panda CSS") |
| Fuente | Inter variable, alojada en el proyecto con `@fontsource-variable/inter` |
| Paquetes | npm |

Crear el proyecto base con:

```bash
npm create cloudflare@latest -- <nombre-del-repo> --framework=react-router
```

Fijar versiones **exactas** de `react-router`, `@react-router/dev` y `@cloudflare/vite-plugin` (sin `^`), y declarar `engines` + `.nvmrc` (React Router 8 exige Node >= 22.22). Usar `npm ci` en CI.

## Rutas y estructura de `app/`

- `app/routes/landing.tsx` es la ruta `/`: la **única** prerenderizada. Todo lo demás es SPA (ver "Prerender de la landing").
- `app/routes/turnos.tsx` es la primera ruta SPA (`/turnos`), con `clientLoader` y `default`. Hoy el loader devuelve una lista vacía: cuando exista la API, llama a `api.turnos.$get`.
- Para sumar una pantalla: crear `app/routes/<ruta>.tsx` y registrarla en `app/routes.ts`. Es SPA salvo que se agregue a `prerender` a propósito.
- `app/components/`: `header`, `logo` y `diagonal-dash-background`, portados de la landing anterior. `app/hooks/use-active-section.ts` resalta la sección activa del menú.
- Íconos: `@phosphor-icons/react`, importando desde `@phosphor-icons/react/ssr` (el mismo paquete que la landing anterior).
- Los enlaces del Header (`#inicio`, `#como-funciona`, `#precios`, `#contacto`) apuntan a secciones que todavía no existen en la landing.

## Prerender de la landing

- `react-router.config.ts`: `{ ssr: false, prerender: ["/"] }`.
- Con `ssr: false` y `/` prerenderizado, se genera además `__spa-fallback.html` para hidratar rutas no prerenderizadas.
- Verificado en una prueba local (React Router 8.5.1, `@cloudflare/vite-plugin` 1.65.0, Vite 8): `build/client/index.html` sale prerenderizado, y `build/server/wrangler.json` apunta `assets.directory` a `../client`. Las requests a `/` se sirven como asset estático **sin invocar el Worker**.
- **Cómo funciona:** React Router 8 hace el prerender levantando el servidor de preview de Vite y pidiéndole `/`; con el plugin de Cloudflare ese preview corre el Worker en workerd, por eso funcionan los bindings y los imports de `cloudflare:workers`.
- **Contradicción con la documentación:** la guía de Cloudflare para React Router dice que SPA mode y prerender no están soportados con el plugin, pero el README actual del plugin lista **React Router v8** como caso de uso. La guía parece desactualizada. Esto es una inferencia: no hay una frase explícita de soporte de prerender. La opción `experimental.prerenderWorker` del plugin sigue marcada como experimental.
- **Guardas:** revisar en cada build la línea `Prerender (html): / -> build/client/index.html`. Si desaparece tras una actualización, algo se rompió.
- Como la landing prerenderizada es un asset estático, **no hace falta Cache API ni lógica de caché** propia.

## Base de datos: Neon + Hyperdrive + Drizzle

- **Crear Hyperdrive con `--caching-disabled`.** Por defecto el caché de queries está activo (max_age 60 s, SWR 15 s) y **no se invalida con escrituras**: leerías datos viejos tras reservar un turno.
- Cliente `pg` **por request** (no global) dentro del Worker. Requiere `nodejs_compat` en `wrangler.jsonc`.
- Conexión de la app: connection string **pooled** de Neon con un **rol dedicado** (`hyperdrive-user`).
- Migraciones con `drizzle-kit` contra la URL **directa** de Neon (no la pooled, no Hyperdrive).
- Neon free: 10 ramas por proyecto, scale-to-zero a los 5 min (no se puede desactivar). Los miembros de la organización son ilimitados en free; roles Admin / Editor / Viewer / Collaborator, y no hay restricción por rama documentada.
- Evitar doble reserva con restricciones **a nivel base** (unique / exclusion constraint) más transacciones reales. `timestamp({ withTimezone: true })`, siempre en UTC.
- Decisión sobre ramas: **no** se crean ramas de Neon automáticamente por PR. Si un compañero necesita una, se le da acceso para crearla cuando la necesite.

### Hyperdrive en desarrollo local

Variable en `.env` (la lee el plugin de Cloudflare):

```
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://usuario:password@host:5432/db
DATABASE_URL=postgres://...   # URL directa de Neon, para drizzle-kit
```

- El sufijo es el **nombre del binding** (`HYPERDRIVE` acá).
- La URL **debe incluir contraseña** o falla con un error de validación (ZodError).
- Localmente no hay pooling ni caché. Verificado de punta a punta contra un Postgres local.
- **No usar `wrangler dev --remote`**: escribe contra producción.
- Poner un `.env.example` sin secretos.
- No verificado: conexión real contra Neon (la sesión de investigación no tenía salida a internet).

## Plan por etapas

El proyecto arranca simple y suma piezas solo cuando hay una razón concreta.

**Etapa 1 (arranque): sin Redis y sin librerías de estado**

- Datos: cada ruta es un route module con `default`, `clientLoader` y `clientAction` (ver "Capa de cliente").
- Better Auth con las sesiones en la base de datos (comportamiento por defecto) y el rate limit con `storage: "database"` (ver "Auth, etapa 1").
- Sin Upstash, sin Zustand, sin TanStack Query, sin limitador por cuenta.
- El sitio sigue con `noindex` y sin usuarios reales: el riesgo de abuso es bajo.

**Etapa 2 (cuando se cumpla alguno de estos disparadores): sumar Redis**

- Se acerca el lanzamiento público, o ya hay usuarios reales con contraseña.
- Aparecen intentos de abuso o ataques de fuerza bruta en los logs.
- El rate limit en la base de datos o la lectura de sesiones empiezan a notarse en la latencia o en la carga de Neon.
- Se necesita el limitador por cuenta contra ataques desde múltiples IP.

Qué incluye la etapa 2 (detalle en "Auth, etapa 2"):

1. Crear el Redis en Upstash (cuenta nueva, São Paulo) y cargar sus credenciales como secretos del Worker.
2. Mover el rate limit y las sesiones a `secondaryStorage`.
3. Agregar el limitador por cuenta en `hooks.before`.
4. Decidir fail-open o fail-closed.

Mover las sesiones de lugar puede invalidar las sesiones existentes: verificarlo antes de hacerlo con usuarios reales.

## Auth y protección

### Hashing en Workers

- Better Auth usa por defecto scrypt (N=16384, r=16, p=1, dkLen 64). Desde la 1.6 usa `node:crypto` nativo; desde better-auth >= 1.7.11 / @better-auth/utils 0.5.0 hay una condición de export `workerd` hacia la versión nativa.
- Medido en workerd: scrypt nativo ~100 ms de CPU, scrypt en JS (noble) ~200 ms, PBKDF2 WebCrypto 100k iteraciones ~55 ms (20k ~14 ms, 10k ~8 ms). PBKDF2 tiene tope de 100k en producción.
- El scrypt nativo de workerd es síncrono dentro de una Promise, así que **cuenta como CPU** igual que el de JS.
- Free: 10 ms de CPU por request, y un hash de ~100 ms puede pasar de forma esporádica por el "built-in flexibility" pero no es confiable. **Plan Workers Paid** (hasta 5 min de CPU) hace que los defaults de Better Auth alcancen. Error 1102 = límite de CPU.
- Las esperas de I/O (Redis, DB) no cuentan como CPU.

### Auth, etapa 1: sin Redis

- Better Auth tiene rate limit **solo en producción** (default 100 req/10 s; `/sign-in/email` 3/10 s).
- Su almacenamiento por defecto es en memoria, que en Workers no se comparte entre las instancias del Worker y por eso no sirve como protección real. Usar la base de datos:

```ts
betterAuth({
  rateLimit: { storage: "database" },
  advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
});
```

- Con `storage: "database"` hace falta la tabla de rate limit en el esquema: generarla con el CLI de Better Auth y migrarla con Drizzle. Confirmar el nombre y los campos en la documentación al implementarlo.
- Las sesiones quedan en la base de datos, que es el comportamiento por defecto. Para un volumen bajo de usuarios alcanza.
- Cada request limitado agrega una escritura a Neon: aceptable en esta etapa, y es una de las razones para pasar a la etapa 2.
- El costo de CPU del hash sigue aplicando: ver "Hashing en Workers" (plan Workers Paid recomendado).

### Auth, etapa 2: rate limit y sesiones con Upstash

- Configuración recomendada:

```ts
betterAuth({
  secondaryStorage: { get, set, delete }, // sobre Upstash
  session: { storeSessionInDatabase: true,
             cookieCache: { enabled: true, maxAge: 5 * 60 } },
  rateLimit: {
    storage: "secondary-storage",
    customRules: {
      "/get-session": false,
      "/sign-up/email": { window: 60, max: 3 },
      "/change-password": { window: 60, max: 5 },
      "/reset-password": { window: 60, max: 5 },
    },
  },
  advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
});
```

- `cookieCache` tiene una advertencia de revocación: una sesión revocada puede seguir válida hasta que venza la cookie (acá, 5 min).
- Si se usa `customStorage.consume`, tiene que ser **atómico** (en LALIsta: script Lua con `INCR` + `EXPIRE`).
- En Workers: `Redis.fromEnv(env)` de `@upstash/redis/cloudflare`. Usar **prefijos** de clave por proyecto (ej. `fibonacci:ba-rl:`).
- Diseño **fail-open** si Redis no responde (como en LALIsta). Evaluar si conviene lo mismo acá.
- Upstash free: 500K comandos/mes, 256 MB, 1 DB por cuenta, PAYG US$0.20/100K. Usar una **cuenta distinta** de la de LALIsta para no compartir cuota. Región sugerida: São Paulo.

### Límite por cuenta contra ataques distribuidos (etapa 2)

Para frenar ataques desde múltiples IP, agregar un limitador por cuenta en `hooks.before` para `/sign-in/email`, **antes** de hashear:

- email + IP: 5 intentos / 15 min
- email solo: 20 intentos / 1 h
- Normalizar el email (trim + lowercase) antes de usarlo como clave.

Referencia: `app/_lib/rate-limit.ts` y `app/_lib/auth-hardening.ts` en `RemesarDev/lalista-frontend`.

**Turnstile queda fuera del plan por ahora.**

## Cloudflare: despliegue

- Crear el repo nuevo con otro nombre y conectarlo a **Workers Builds desde el principio**: push a `main` → `wrangler deploy`. Ramas no productivas: desactivar los builds o usar `wrangler versions upload` (Preview URLs).
- Bloquear indexación de `*.workers.dev` de forma permanente.
- Dominio: en `wrangler.jsonc`, `routes: [{ pattern: "fibonacci.com.ar", custom_domain: true }]`.
- El Worker `fibonacci-turnos` viejo tiene los dominios `fibonacci.com.ar` y `app.fibonacci.com.ar` como Custom Domains, y tiene Workers Builds conectado al repo viejo. Hay también otros Workers en la cuenta: `core` y `vite-preact-template`.
- Free plan actual; no hay Hyperdrive creado todavía.

### Migración desde el Worker viejo

1. Probar el Worker nuevo en su URL `workers.dev`.
2. Desconectar el repo viejo del Worker `fibonacci-turnos`.
3. Quitar los Custom Domains del Worker viejo y agregarlos al nuevo (los Custom Domains solo pueden estar en un Worker a la vez).
4. Revisar las **4 reglas de zona** del intento anterior (`Rewrite_Landing_Root`, `Landing_redirigir_rutas_rotas_raiz`, `App - bloquear acceso a /landing`, `Landing_bloquear_assets_inexistentes`): con la plantilla nueva probablemente sobran o chocan. Adaptarlas o borrarlas.
5. Decidir si `app.fibonacci.com.ar` sigue existiendo. Con un único Worker y una sola SPA, probablemente no hace falta.

El workflow `preview.yml` ("Notificador L7") del repo viejo comentaba la Preview URL en cada commit; es opcional recrearlo.

## SEO

- Mientras esté en construcción: `X-Robots-Tag: noindex, nofollow` en todo el sitio vía `public/_headers`. **TODO: sacar ese bloque el día del lanzamiento** y mantener siempre el bloqueo de `*.workers.dev`.
- `public/llms.txt` describe capacidades aspiracionales (reservas, pagos, panel de alumno) aunque no estén construidas. Decisión consciente del autor.

## TypeScript

La plantilla de React Router ya trae un entorno donde Hono corre bien: `tsconfig.json` con referencias, `tsconfig.cloudflare.json` (app + `workers/`) y `tsconfig.node.json`; `wrangler types` genera el `Env`.

```ts
const app = new Hono<{ Bindings: Env }>().basePath("/api");
```

- No verificado todavía: `npm run typecheck` con Hono dentro de esta plantilla, y el ruteo de Hono en `workers/app.ts` (la plantilla trae `fetch(request) { return requestHandler(request); }`; hay que enrutar `/api/*` a Hono y el resto a React Router).
- **No traer `run_worker_first` ni `not_found_handling` del proyecto anterior.** El plugin de Cloudflare genera `"assets": {"directory": "../client"}` sin `not_found_handling`: Cloudflare sirve el archivo si existe y, si no, invoca el Worker. Por eso `/api/*` ya llega al Worker sin configurar nada. Esa configuración existía antes por el fallback `single-page-application`, que interceptaba todo.
- **No agregar `not_found_handling: "single-page-application"`**: serviría el `index.html` de la raíz, que acá es la landing prerenderizada.
- Solo se sirven como estáticos los archivos que existen (`/`, `assets/`, etc.). Cualquier otra ruta pasa por el Worker y la resuelve React Router. Probado con `vite preview`: una ruta inexistente devuelve un 404 de React Router, no el shell de la SPA. No verificado en un deploy real.
- Opcional: `run_worker_first: ["/api/*"]` es inofensivo y garantiza que ningún archivo estático tape la API.

## Tipos compartidos entre API y frontend (Hono RPC + Zod + Better Auth)

Frontend y API viven en el mismo repo, así que el contrato se comparte por **inferencia de tipos**, sin OpenAPI ni generación de código.

**Hono RPC + Zod**

- Cada ruta valida con `zValidator` (`@hono/zod-validator`) y el archivo de la API exporta `export type AppType = typeof app`.
- El frontend llama con `hc<AppType>("/")`: rutas, `param`, `query`, `json` y la respuesta quedan tipados, y un cambio en el servidor rompe el `typecheck` del frontend.
- Los esquemas de Zod se definen **una sola vez** y se reutilizan para validar los formularios del cliente.
- Encadenar las rutas (`new Hono().basePath("/api").get(...).post(...)`) para que la inferencia funcione, con `strict: true`. Partir en sub-routers por módulo (reservas, alumnos, etc.) si el tipo crece y el editor o `tsc` se vuelven lentos.
- Es HTTP normal: las rutas siguen siendo URLs y métodos comunes. El RPC **no valida las respuestas en runtime**; es solo una garantía de tipos. Chequear siempre `res.ok`: los errores de estado y de red no vienen tipados.

**Better Auth**

- Cliente con `createAuthClient<typeof auth>()` (o el plugin `inferAdditionalFields<typeof auth>()` para campos extra como `role`), que hereda los tipos de la configuración del servidor.
- Better Auth tiene su propio cliente tipado: **no pasa por Hono RPC**, aunque se monte dentro de Hono con `auth.handler(c.req.raw)`.

**Reglas**

- El frontend importa del servidor **solo con `import type`** (el tipo `AppType` y el tipo de `auth`). Nunca `import { app }` ni nada que arrastre código de servidor al bundle del cliente. Es compatible con erasable syntax porque todo se borra al compilar.
- Si es posible, reforzarlo con una regla de lint que prohíba importar valores desde el código del Worker en `app/`.

## Panda CSS

Panda está instalado y Tailwind ya se quitó de la plantilla (paquetes, plugin de Vite y `@import` del CSS).

- Motivación: **contrato de diseño** tipado, que el diseñador pueda trabajar sobre tokens y que el equipo no se desvíe de la guía de estilos.
- CSS-in-JS de build time. Instalación según la guía oficial para React Router (<https://panda-css.com/docs/get-started/react-router>), con el plugin `@pandacss/vite` (no PostCSS).
- `vite.config.ts`: `pandacss()` va entre el plugin de Cloudflare y `reactRouter()`.
- Colores en dos capas, dentro de `theme.extend`:
  - `tokens.colors` (valores crudos, la única paleta; no se usan directo en componentes): `brand.navy` `#002045`, `brand.blue` `#0061a5`, `neutral.snow` `#f7fafc`, `neutral.mist` `#e0e3e5`, `neutral.slate` `#43474e`. Son los valores reales de la landing anterior (`fibonacci-turnos`). Blanco y `red.600` salen del preset de Panda.
  - `semanticTokens.colors`: los **roles** que usan los componentes: `bg` / `bg.muted`, `text`, `heading`, `border`, `primary` / `primary.text` / `primary.text.muted` / `primary.text.subtle` / `primary.border`, `secondary` / `secondary.text`, `danger` / `danger.text`. Hoy solo tienen valor claro. `primary.text.muted`, `.subtle` y `primary.border` son blanco con 70 %, 50 % y 10 % de opacidad (`{colors.white/70}`), igual que el footer anterior. El `body` aplica `bg` y `text` desde `globalCss`.
  - **Modo oscuro postergado a propósito**: soportarlo obliga a probar cada pantalla dos veces. El sitio está fijado en claro (`color-scheme: light`, sin logo oscuro). Como los componentes usan roles, sumarlo después es pasar cada valor de `semanticTokens` a `{ base, _osDark }` (sigue la preferencia del sistema, sin JavaScript) y restaurar `color-scheme: light dark`.
  - Los roles son una **sugerencia**, no una obligación: conviene usarlos (`css({ bg: "bg", color: "text" })`) para mantener coherencia y el modo oscuro, pero se puede improvisar con otros colores cuando haga falta. Si un color improvisado se repite, promoverlo a rol.
  - El par `x` / `x.text` es siempre fondo y el texto que va encima (por ejemplo `bg: "primary", color: "primary.text"`).
  - `primary` también sirve de fondo de secciones enteras (como el footer): ahí se usan `primary.text` para lo principal, `primary.text.muted` para bajadas y enlaces y `primary.border` para divisorias.
  - `heading` es el navy como color de **texto** en títulos grandes; no confundir con `primary`, que es una superficie. `bg.muted` y `border` comparten el valor crudo `neutral.mist`; ningún hex se repite en los roles.
- `panda.config.ts`: presets `@pandacss/preset-base` y `@pandacss/preset-panda`, `include` sobre `./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}` y `outdir: "styled-system"`. Toda ruta o componente nuevo tiene que quedar cubierto por `include`.
- `strictTokens` **no** está activado. Se puede reconsiderar cuando estén definidos los tokens propios del diseño.
- `styled-system/` se genera con `panda codegen` (script `prepare`, corre con `npm ci`) y está en `.gitignore`. No se commitea.
- `app/app.css` solo declara el orden de capas (`@layer reset, base, tokens, recipes, utilities;`) e importa la fuente (`@fontsource-variable/inter`); el plugin inyecta el CSS generado. Se carga desde `app/root.tsx` con `app.css?url` y la función `links`.
- Imports: `import { css } from "styled-system/css"`. El alias está en `paths` de `tsconfig.cloudflare.json`. **No** agregar `styled-system` al `include` del tsconfig: con `checkJs` TypeScript revisa los `.js` generados y falla el `typecheck`.
- Las clases utilitarias (`className="flex ..."`) que quedan en el `ErrorBoundary` de `app/root.tsx` son de la plantilla y no hacen nada: reemplazarlas con `css()` al tocar esa pantalla.
- Opcional, no activado: `pandacss({ transform: true })` reescribe las llamadas estáticas a `css()` como strings de clases en build y evita el runtime de estilos.
- Aprendizaje didáctico: documentar lo que se aprende para que sirva a otros.

## Fuente

- Inter variable con `@fontsource-variable/inter`, importada en `app/app.css`. La familia es `"Inter Variable"`.
- Fuente única de verdad: el token `fonts.inter` de `panda.config.ts`. El `body` la aplica desde `globalCss` (`fontFamily: 'inter'`), junto con `color-scheme: light` en `html`. No repetir el `font-family` en `app.css`.
- No se usa Google Fonts: evita requests a dominios externos, el envío de datos de cada visita a Google y la dependencia de un tercero. Los `.woff2` salen del propio Worker y la versión queda fijada en el lockfile.

## Skills del agente

Instaladas con `npx skills add` (alcance de proyecto): el archivo real queda en `.agents/skills/`, hay un symlink en `.claude/skills/` y las versiones se registran en `skills-lock.json`. Para sumar una, usar el mismo comando **sin** `-a claude-code`, que copia la carpeta en vez de crear el symlink.

- Better Auth: `better-auth-best-practices`, `better-auth-security-best-practices`, `create-auth`, `email-and-password-best-practices`, `organization-best-practices`, `two-factor-authentication-best-practices`.
- Datos y API: `drizzle-orm`, `hono`.
- Frontend: `react-router-framework-mode`, `panda-css`, `panda-css-theming`.
- Cloudflare: `workers-best-practices`, `wrangler`.
- Zod: se probó una skill y se quitó. Su ejemplo de `z.nativeEnum` con un `enum` de TypeScript choca con erasable syntax. Si se vuelve a instalar, usar `z.enum([...])` y `z.infer`, nunca `enum`.

## Capa de cliente (etapa 1)

La app es una **SPA**: nada se renderiza en el servidor salvo la landing prerenderizada (`ssr: false`). Los datos los pide el navegador a la API.

**Cada ruta es un route module** (`app/routes/<ruta>.tsx`) con tres exports que React Router reconoce por su nombre (no se importan, se definen y se exportan):

- `clientLoader`: lectura. Corre en el navegador antes de mostrar la ruta y llama a la API con el cliente de Hono RPC.
- `clientAction`: escritura. Recibe el `<Form>` de la ruta, llama a la API y, al terminar, React Router vuelve a ejecutar los `clientLoader` y refresca la pantalla.
- `default`: el componente. Lee el resultado de `loaderData` y `actionData` (tipados con los tipos `Route` que genera `react-router typegen`).

Las rutas se registran en `app/routes.ts`.

```ts
// app/lib/api.ts
import { hc } from "hono/client";
import type { AppType } from "../../workers/api"; // import type, nunca valores
export const api = hc<AppType>("/").api;
```

```tsx
// app/routes/turnos.tsx
import { data, Form } from "react-router";
import type { Route } from "./+types/turnos";
import { api } from "~/lib/api";

export async function clientLoader() {
  const res = await api.turnos.$get({ query: { desde: "2026-11-01" } });
  if (!res.ok) throw data("No se pudieron cargar los turnos", { status: res.status });
  return res.json();
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const res = await api.turnos.$post({
    json: { fecha: String(form.get("fecha")), alumnoId: Number(form.get("alumnoId")) },
  });
  if (!res.ok) return { error: "No se pudo reservar" };
  return { ok: true };
}

export default function Turnos({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <>
      <ul>{loaderData.map((t) => <li key={t.id}>{t.fecha}</li>)}</ul>
      <Form method="post">
        <input name="fecha" type="date" />
        <input name="alumnoId" type="number" />
        <button>Reservar</button>
      </Form>
      {actionData?.error && <p>{actionData.error}</p>}
    </>
  );
}
```

**Convenciones**

- Las lecturas van en `clientLoader` y las escrituras en `clientAction`. No hacer `fetch` dentro de `useEffect`.
- Chequear siempre `res.ok`: `hc` no lanza por un 404 o un 500. Lanzar `data(...)` envía a la pantalla de error de la ruta (`ErrorBoundary`); devolver un objeto desde `clientAction` permite mostrar el error junto al formulario.
- Para redirigir tras guardar: `return redirect("/turnos")` en el `clientAction`.
- Los esquemas de Zod del servidor se pueden reutilizar en el `clientAction` para mostrar errores por campo antes de llamar a la API.
- La cookie de sesión de Better Auth viaja sola porque `hc("/")` apunta al mismo origen.
- La sesión del usuario se lee con `authClient.useSession()`.
- Estado de pantalla: `useState` para lo local y `useSearchParams` (la URL) para filtros que se quieran compartir o recargar.
- Los datos del servidor **no** se copian a un store.

**Qué se descarta por ahora y cuándo reconsiderarlo**

- **Zustand:** solo si hay estado de interfaz que muchos componentes lejanos necesiten y que no quepa en `useState`, la URL o un contexto (por ejemplo un borrador de reserva que sobrevive entre rutas distintas).
- **TanStack Query:** solo si se necesita caché en el cliente, mostrar datos viejos mientras se actualizan, polling (por ejemplo de disponibilidad) o actualizaciones optimistas. Se lleva bien con `hc`: se usa dentro de `queryFn`.
- Signals se descartó.
- Agregar una librería más adelante es fácil; sacarla cuando ya está en todos lados cuesta más.

No verificado: este patrón no se probó todavía contra la plantilla (alias `~/`, import de `AppType`, `typecheck`).

## Contexto académico

La materia de desarrollo web usa React Router como librería; usarlo como framework demuestra dominio igual. Este proyecto sirve también como práctica de portfolio.

## Pasos pendientes

**Los hace Claude, cuando haya repo:**

- Bootstrap con la plantilla de React Router, `ssr: false` + `prerender: ["/"]`, versiones fijas.
- Hono para `/api/*` en `workers/app.ts`, `.env.example`, Drizzle + `pg`, binding de Hyperdrive.
- Better Auth con sesiones y rate limit en la base de datos (etapa 1).
- Primera ruta de ejemplo con `clientLoader` + `clientAction` + cliente `hc`.
- Verificar `npm run typecheck` y la línea de prerender del build.
- **Etapa 2:** Upstash, `secondaryStorage` y limitador por cuenta (ver "Plan por etapas").

**Los hace Josué:**

- Elegir nombre y crear el repo vacío en GitHub (dar acceso con push para poder subir).
- Neon: crear la base, rama `dev`, connection string pooled y rol `hyperdrive-user`.
- **Etapa 2:** Upstash: crear el Redis en la cuenta nueva (São Paulo). No hace falta en la etapa 1.
- Cloudflare: conectar el repo con "Import a repository", crear Hyperdrive con caché desactivado, migrar los dominios y limpiar las reglas de zona.
- Construir la sección "Precios" de la landing cuando llegue el momento.

## Convenciones

- Idioma de la interfaz y comentarios: español (Argentina).
- Commits en español, pequeños y descriptivos.
- Antes de agregar una dependencia: ¿es erasable-syntax friendly, mantenida y aburrida?
