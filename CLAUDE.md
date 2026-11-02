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
| API | Hono (`workers/api.ts`) enrutado desde `workers/app.ts` bajo `/api/*`, con Hono RPC |
| Validación | Zod (`@hono/zod-validator`), esquemas compartidos con el frontend |
| DB | Postgres **17** en Neon, vía Hyperdrive |
| ORM | Drizzle con driver `pg` (Postgres.js no está soportado en Hyperdrive) |
| IDs | UUID v4 (`gen_random_uuid()`), más `created_at` en cada tabla |
| Auth | Better Auth. Método de acceso (¿solo Google?) y modelo de roles (¿campo `role` o plugin?) **por evaluar**: ver "Método de acceso y roles (por evaluar)" |
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
- `app/components/`: `Button` (ver "Componentes estilizados"), `LandingHeader`, `Logo` y `Diagonal-dash-background`, portados de la landing anterior. `Logo` es un `Link` de React Router a `/` (sirve en cualquier pantalla, también en la SPA). `app/hooks/use-active-section.ts` resalta la sección activa del menú.
- `app/lib/`: `seo.ts` (helper `seo()` para el `meta` de rutas públicas), `preload.ts` (`preloadFonts()`, precarga de la fuente) y `api.ts` (cliente `hc` de Hono RPC).
- Íconos: `@phosphor-icons/react`, importando desde `@phosphor-icons/react/ssr` (el mismo paquete que la landing anterior).
- Los enlaces del Header (`#inicio`, `#como-funciona`, `#precios`, `#contacto`) apuntan a secciones que todavía no existen en la landing.

## Prerender de la landing

- `react-router.config.ts`: `{ ssr: false, prerender: ["/"] }`.
- Con `ssr: false` y `/` prerenderizado, se genera además `__spa-fallback.html` para hidratar rutas no prerenderizadas.
- Verificado en una prueba local (React Router 8.5.1, `@cloudflare/vite-plugin` 1.65.0, Vite 8): `build/client/index.html` sale prerenderizado, y `build/server/wrangler.json` apunta `assets.directory` a `../client`. Las requests a `/` se sirven como asset estático **sin invocar el Worker**.
- **Cómo funciona:** React Router 8 hace el prerender levantando el servidor de preview de Vite y pidiéndole `/`; con el plugin de Cloudflare ese preview corre el Worker en workerd, por eso funcionan los bindings y los imports de `cloudflare:workers`.
- **Contradicción con la documentación:** la guía de Cloudflare para React Router dice que SPA mode y prerender no están soportados con el plugin, pero el README actual del plugin lista **React Router v8** como caso de uso. La guía parece desactualizada. Esto es una inferencia: no hay una frase explícita de soporte de prerender. La opción `experimental.prerenderWorker` del plugin sigue marcada como experimental.
- **Guardas:** revisar en cada build la línea `Prerender (html): / -> build/client/index.html`. Si desaparece tras una actualización, algo se rompió.
- **Timeout intermitente:** `Prerender: Request failed for /: The operation was aborted due to timeout` apareció en varios builds locales y pasó al reintentar sin cambiar nada. Sin causa encontrada. Si se repite seguido o falla en CI, investigarlo.
- Con un binding de Hyperdrive, el servidor de preview del prerender exige una cadena local aunque `/` no consulte la base: por eso `wrangler.jsonc` lleva un `localConnectionString` de relleno (ver "Base de datos").
- Como la landing prerenderizada es un asset estático, **no hace falta Cache API ni lógica de caché** propia.

## Base de datos: Neon + Hyperdrive + Drizzle

- **Crear Hyperdrive con `--caching-disabled`.** Por defecto el caché de queries está activo (max_age 60 s, SWR 15 s) y **no se invalida con escrituras**: leerías datos viejos tras reservar un turno.
- Hyperdrive creado: nombre `fibonacci-db`, ID `aac32d06ed2849528e1aab9e58aea881`, **sin caché**. Apunta al **host directo** de la rama `production` (sin `-pooler`): Hyperdrive ya hace su propio pooling.
- Previews: `wrangler preview` (lo que corre Workers Builds en ramas no productivas) no hereda los bindings y exige un bloque `previews` en `wrangler.jsonc`. Usa `fibonacci-db-dev` (ID `ea6dfb7cd7de4fabb822e9d421f6bb4b`, sin caché), que apunta a la rama `dev`, para que una preview nunca escriba en `production`. Si se agrega un binding nuevo, hay que declararlo también ahí.
- `wrangler.jsonc`: `placement.region` en `aws:sa-east-1` porque Hyperdrive no acerca el Worker a la base (también aplica a las previews), y `observability.traces` activado aparte, porque `observability.enabled` no lo hace (muestreo del 1 %).
- Las URLs de preview son **públicas** salvo que se protejan con Cloudflare Access. Las de `workers.dev` llevan `noindex` automático.
- Crear o editar los Hyperdrive **desde el panel de Cloudflare**: los comandos por `npx` imprimen los argumentos ya expandidos (`npm notice`), así que una `--connection-string` deja la contraseña en pantalla. Editar una configuración no cambia su ID.
- Cliente `pg` **por request** (no global) dentro del Worker. Requiere `nodejs_compat` en `wrangler.jsonc`. Se usa con `withDb(env, ctx, async (db) => ...)` de `workers/db/client.ts`: abre la conexión, corre la función y recién después cierra con `ctx.waitUntil(client.end())`. **No** llamar a `client.end()` antes de consultar: `end()` se ejecuta al llamarlo, no al responder, y cierra el cliente antes de la consulta (`Client was closed and is not queryable`).
- `withDb` pide solo `Pick<ExecutionContext, "waitUntil">`: el `c.executionCtx` de Hono no es el mismo tipo que el `ExecutionContext` de Cloudflare.
- Rol: hoy se usa `fibonacci_owner`. Queda pendiente crear un **rol dedicado** (`hyperdrive-user`) con los permisos mínimos para la app.
- `wrangler.jsonc`: binding `HYPERDRIVE`, flag `nodejs_compat` y un `localConnectionString` **de relleno, sin credenciales reales**. Hace falta porque el build (prerender) y Workers Builds exigen una cadena local aunque no consulten la base. La real va en `.env`.
- Migraciones con `drizzle-kit` contra la URL **directa** de Neon (no Hyperdrive).
- Neon free: 10 ramas por proyecto, scale-to-zero a los 5 min (no se puede desactivar). Los miembros de la organización son ilimitados en free; roles Admin / Editor / Viewer / Collaborator, y no hay restricción por rama documentada.
- Evitar doble reserva con restricciones **a nivel base** (unique / exclusion constraint) más transacciones reales. `timestamp({ withTimezone: true })`, siempre en UTC.
- Decisión sobre ramas: **no** se crean ramas de Neon automáticamente por PR. Si un compañero necesita una, se le da acceso para crearla cuando la necesite.
- Proyecto Neon `fibonacci` (sa-east-1), base `fibonacci`, Postgres **17**. Ramas: `production` (la por defecto, la usa Hyperdrive en Cloudflare) y `dev` (desarrollo y pruebas).
- **`DATABASE_URL` y la cadena local de Hyperdrive apuntan siempre a `dev`.** Las migraciones se aplican por rama: para migrar `production`, solo cuando Josué lo pida, usar `npm run db:migrate:prod`, que corre `drizzle-kit migrate` con `drizzle.prod.config.ts` (igual que `drizzle.config.ts`, pero lee la cadena **directa** de la rama `production` de la variable `PROD_DATABASE_URL`). Antes de migrar, `scripts/confirmar-prod.ts` muestra el host (nunca usuario ni contraseña) y pregunta `¿Confirmar? (s/N)`: solo `s` sigue, Enter cancela, y sin terminal interactiva se niega. Va en un archivo aparte porque probamos ponerlo dentro de `drizzle.prod.config.ts` y no sirve: `drizzle-kit` carga la configuración como CommonJS (sin `await` de nivel superior) y la alternativa síncrona con `readSync` no deja escribir en la terminal real (devuelve vacío y cancela). No chequea que la cadena sea la de `production` ni que sea la directa: eso depende de lo que haya en `PROD_DATABASE_URL`. El orden en cada cambio de esquema: `db:generate`, `db:migrate` en `dev` y probar, commitear `drizzle/`, `db:migrate:prod` y recién después desplegar el código. Los cambios tienen que ser compatibles hacia atrás (primero agregar, después borrar), porque entre la migración y el deploy corre el código viejo contra el esquema nuevo.
- **Drizzle** (versión estable, exacta): `drizzle-orm` 0.45.4, `drizzle-kit` 0.31.11. Esquema en `workers/db/schema.ts`, configuración en `drizzle.config.ts` (carga `.env` con `process.loadEnvFile()` en un `try`, porque en CI no existe). Scripts: `db:generate` y `db:migrate`. **No usar `drizzle-kit push`.**
- La carpeta `drizzle/` se **commitea completa, `drizzle/meta` incluida**: el `_journal.json` es la lista ordenada de migraciones que lee `migrate`, y los snapshots son lo que compara `generate`. Cada `db:generate` se commitea junto con el cambio de `schema.ts`.
- **IDs: UUID v4** (`uuid().primaryKey().defaultRandom()` en Drizzle, `gen_random_uuid()` en SQL). Con PG17 no hay `uuidv7()` (es nativo desde PG18). Validar con `z.uuid()`. No son un reemplazo del control de acceso: **cada ruta tiene que verificar en el servidor que el recurso pertenece al usuario de la sesión**. Todas las tablas llevan `created_at` con `timestamp({ withTimezone: true })` y `defaultNow()`.
- Está en revisión pero **no se usa** el soporte de `RETURNING OLD/NEW` de PG18 (PR #6568 de Drizzle, sin mergear y solo para PG18).
- La tabla `ping` y la ruta `/api/health` son de prueba (verifican la conexión de punta a punta). `/api/health` es un GET que escribe: borrarlos cuando haya tablas reales.

### Hyperdrive en desarrollo local

Variable en `.env` (la lee el plugin de Cloudflare):

```
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://usuario:password@host:5432/db
DATABASE_URL=postgres://...   # URL directa de Neon, para drizzle-kit
```

- El sufijo es el **nombre del binding** (`HYPERDRIVE` acá).
- La URL **debe incluir contraseña** o falla con un error de validación (ZodError).
- Localmente no hay pooling ni caché. Verificado de punta a punta contra un Postgres local y contra la rama `dev` de Neon (`/api/health` responde y el contador sube).
- La variable de `.env` tiene que ser de la rama `dev`. Si apunta a una rama sin la migración, falla con `relation "ping" does not exist`.
- **No usar `wrangler dev --remote`**: escribe contra producción.
- `.env.example` (sin secretos) ya existe. `.env` y `.dev.vars*` están en `.gitignore`.
- La primera petición después de instalar dependencias nuevas es lenta en dev (Vite reoptimiza dependencias, ~25 s); las siguientes tardan menos de 0,4 s.

## Plan por etapas

El proyecto arranca simple y suma piezas solo cuando hay una razón concreta.

**Etapa 1 (arranque): sin Redis y sin librerías de estado**

- Datos: cada ruta es un route module con `default`, `clientLoader` y `clientAction` (ver "Capa de cliente").
- Better Auth con las sesiones en la base de datos (comportamiento por defecto) y el rate limit con `storage: "database"` (ver "Auth, etapa 1").
- Sin Upstash, sin Zustand, sin TanStack Query, sin limitador por cuenta.
- El sitio sigue con `noindex` y sin usuarios reales: el riesgo de abuso es bajo.

**Etapa 2 (cuando se cumpla alguno de estos disparadores): sumar Redis**

- Se acerca el lanzamiento público, o ya hay usuarios reales.
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

### Método de acceso y roles (por evaluar)

> **Nada de esta sección está decidido.** Es una propuesta para arrancar; hay que evaluar las necesidades reales antes de implementar Better Auth.

- Usuarios: alumnos y profesores. El registro de profesores **no es prioritario**.

**Método de acceso: ¿solo Google?** (propuesta, no decidido)

- A favor: no hay contraseñas que guardar ni hashear (se evita el costo de CPU de scrypt en Workers Free), no hace falta un servicio de correo para verificación y recuperación, y hay menos superficie de ataque.
- En contra: quedan afuera quienes no tengan cuenta de Google (por ejemplo, alumnos menores) y se depende de un tercero. Si aparecen, se suma email y contraseña (Better Auth vincula las cuentas por email verificado).
- Las secciones "Hashing en Workers" y el limitador por cuenta de la etapa 2 aplican **solo si se usa email y contraseña**.
- Si se usa Google, lo prepara Josué en Google Cloud: credenciales OAuth, pantalla de consentimiento con el dominio y los permisos básicos (`openid`, `email`, `profile`), redirect URIs de producción, `workers.dev` y `localhost`, y pasar la app de "Testing" a "Production" (en Testing solo entran 100 usuarios de prueba cargados a mano).

**Roles: ¿un campo `role` o un plugin?** (por evaluar según las necesidades)

- Opción simple: un campo `role` en el usuario (`alumno` | `profesor`, validado con `z.enum`, nunca un `enum` de TypeScript), por defecto `alumno`, con `input: false` para que nadie pueda ponerse `profesor` desde el cliente. En el frontend llegaría tipado con `inferAdditionalFields<typeof auth>()`. Los profesores se promoverían a mano en la base de Neon.
- Opciones con plugin de Better Auth (por ejemplo `organization`, con roles, equipos e invitaciones, o `admin`, con roles y permisos). Hay una skill de `organization-best-practices` instalada.
- Preguntas que definen la elección: si cada profesor tiene su propia agenda y sus propios alumnos, si hace falta dar permisos finos (quién puede ver, cancelar o editar turnos de quién), quién administra el instituto y si habrá profesores que se sumen por su cuenta.

**Válido en cualquier caso**

- Better Auth: configurar `advanced.database.generateId: "uuid"` y confirmar al generar el esquema que las columnas salgan como `uuid` y no `text`, para que las claves foráneas de `turnos` tengan el mismo tipo que `user.id`.
- `auth` se crea **por request** en el Worker (la conexión sale del binding `HYPERDRIVE`), igual que el cliente `pg`. Hace falta `BETTER_AUTH_SECRET` como secreto del Worker y la `baseURL` del dominio.

### Hashing en Workers

> Aplica solo si se usa email y contraseña (ver "Método de acceso y roles (por evaluar)").

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
- El costo de CPU del hash aplica solo si se usa email y contraseña: ver "Hashing en Workers" (plan Workers Paid recomendado).

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
- Free plan actual. Hyperdrive `fibonacci-db` ya está creado (ver "Base de datos"). Josué confirmó que la app ya está conectada a su dominio.

### Migración desde el Worker viejo

1. Probar el Worker nuevo en su URL `workers.dev`.
2. Desconectar el repo viejo del Worker `fibonacci-turnos`.
3. Quitar los Custom Domains del Worker viejo y agregarlos al nuevo (los Custom Domains solo pueden estar en un Worker a la vez).
4. Revisar las **4 reglas de zona** del intento anterior (`Rewrite_Landing_Root`, `Landing_redirigir_rutas_rotas_raiz`, `App - bloquear acceso a /landing`, `Landing_bloquear_assets_inexistentes`): con la plantilla nueva probablemente sobran o chocan. Adaptarlas o borrarlas.
5. Decidir si `app.fibonacci.com.ar` sigue existiendo. Con un único Worker y una sola SPA, probablemente no hace falta.

El workflow `preview.yml` ("Notificador L7") del repo viejo comentaba la Preview URL en cada commit; es opcional recrearlo.

## SEO

- Mientras esté en construcción: `X-Robots-Tag: noindex, nofollow` en todo el sitio vía `public/_headers`. **TODO: sacar el primer bloque (`/*`) el día del lanzamiento** y mantener siempre el de `*.workers.dev`.
- **Límite conocido:** `_headers` solo aplica a los **archivos estáticos** (la landing, favicons, imagen OG, assets). Las respuestas que genera el Worker (`/turnos`, `/api/*`, 404) **no llevan el header**. Decisión: no agregar código en `workers/app.ts` para eso (se evaluó una función que lo agrega a toda respuesta y se descartó por agresiva). Si más adelante hace falta cubrirlas, la opción mínima es un `<meta name="robots" content="noindex, nofollow">` en el `Layout` de `app/root.tsx`. Las rutas SPA no tienen HTML propio y `/turnos` va a requerir sesión.
- **`meta` por ruta, no un componente `Seo`.** Rutas públicas (landing): `export const meta = () => seo({ title, description, url, image })` con el helper de `app/lib/seo.ts` (título, descripción, Open Graph y Twitter). Rutas SPA: solo el título (`[{ title: "..." }]`); Open Graph no les sirve porque las vistas previas leen el HTML del servidor. El `meta` de una ruta **reemplaza** al del padre, no se mezclan. Las URLs de `og:image` tienen que ser absolutas.
- Favicons y imagen OG: `public/favicon.svg` (con modo oscuro), `public/favicon.ico` y `public/og-image.png`, copiados de la landing anterior. Los `<link rel="icon">` están en `links` de `app/root.tsx`.
- Precarga de la fuente: `preloadFonts()` (`app/lib/preload.ts`) agrega un `<link rel="preload">` del `.woff2` del subset `latin` de Inter, con `crossOrigin: "anonymous"` (obligatorio en fuentes). **Solo en producción** (`import.meta.env.PROD`): en dev Vite sirve la fuente con otra URL que el `@font-face` y se descargaría dos veces. Acorta la cadena HTML → CSS → fuente; la ganancia es modesta porque la landing sale de la CDN, y no se midió.
- `public/llms.txt` describe capacidades aspiracionales (reservas, pagos, panel de alumno) aunque no estén construidas. Decisión consciente del autor.

## TypeScript

La plantilla de React Router ya trae un entorno donde Hono corre bien: `tsconfig.json` con referencias, `tsconfig.cloudflare.json` (app + `workers/`) y `tsconfig.node.json`; `wrangler types` genera el `Env`.

```ts
const app = new Hono<{ Bindings: Env }>().basePath("/api").get(/* ... */);
```

- Verificado: `npm run typecheck` con Hono dentro de esta plantilla. `workers/app.ts` es solo un enrutador: si la ruta es `/api` o empieza con `/api/`, delega en `api.fetch(request, env, ctx)` (`workers/api.ts`); el resto va a React Router. Dentro de Hono, `c.env` es el `Env` tipado (con `HYPERDRIVE`) y `c.executionCtx` es el contexto de ejecución.
- `wrangler types` genera `worker-configuration.d.ts` (en `.gitignore`; se regenera con `postinstall` y `npm run typecheck`). Volver a correr `npm run cf-typegen` al cambiar `wrangler.jsonc`.
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
- Versiones fijas (estables, exactas): `hono` 4.13.15 (la v5 sigue en release candidate), `@hono/zod-validator` 0.9.1, `zod` 4.6.7. Verificado: el tipo de la respuesta de `api.health.$get()` llega al cliente (`fila.n` tipa como `number`).
- `workers/api.ts` define `.notFound(...)` para que las rutas inexistentes bajo `/api` devuelvan JSON (`{ "error": "No encontrado" }`, 404) y no texto plano.
- Las rutas **GET son de solo lectura**; las escrituras van en POST / PUT / DELETE.
- `@hono/cli` se probó y se descartó: la 0.1.11 (`latest`) solo tiene `request`, y empaquetar `workers/api.ts` falla por `pg` (`Dynamic require of "events"`). La documentación describe la 1.0 rc, y en esa solo anduvo `--runtime vite`, que equivale a un `curl` contra `npm run dev`. Reevaluar cuando salga la 1.0 estable o si la API crece. Mientras tanto, probar con `npm run dev` y `curl`.
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

### Componentes estilizados

Patrón: `app/components/Button.tsx`. Las reglas se apoyan en la documentación de Panda ([css, cx y cva](https://panda-css.com/docs/reference/css), [estilos dinámicos](https://panda-css.com/docs/styling/dynamic-styling)). Pasar `className` generado en el sitio de uso no está documentado ahí; referencia: [`cybersemics/em`, PR 5949](https://github.com/cybersemics/em/pull/5949).

- La receta es un `cva` dentro del archivo del componente, sin exportar. Un componente por elemento sobre la misma receta (`Button` y `ButtonLink`).
- Los estilos de afuera entran solo por `className`, generado donde se usa: `className={css({ ... })}`. El componente lo suma con `cx(receta({ variant }), className)`.

A tener en cuenta:

- Nunca pasar `css.raw` ni llamar a `css()` con argumentos que llegan por props: Panda no los extrae (`panda_call_unextractable`).
- `cx` no resuelve conflictos: la receta no define propiedades que los consumidores vayan a cambiar (el botón no define `display`).
- Los valores calculados en runtime no se extraen: usar variantes o una variable CSS.
- Comprobar con `npx panda cssgen --outfile <archivo>`: debe dar `diagnostics: 0`.

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
    json: { fecha: String(form.get("fecha")), alumnoId: String(form.get("alumnoId")) }, // UUID
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
        <input name="alumnoId" />
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

Verificado: el import de `AppType` y el `typecheck` con `app/lib/api.ts` (el tipo de la respuesta llega al cliente). No verificado: el patrón completo `clientLoader` / `clientAction` contra una ruta real de la API (el loader de `turnos` todavía devuelve una lista vacía).

## Contexto académico

La materia de desarrollo web usa React Router como librería; usarlo como framework demuestra dominio igual. Este proyecto sirve también como práctica de portfolio.

## Pasos pendientes

**Hecho:** bootstrap con la plantilla, `ssr: false` + prerender de `/`, Panda, SEO de la landing, Neon (proyecto, ramas `production` y `dev`), Hyperdrive sin caché, Drizzle + `pg` con `withDb`, migración inicial (`ping`), Hono en `/api/*` con Hono RPC tipado y la app conectada al dominio.

**Los hace Claude:**

- Better Auth, **una vez definidos** el método de acceso y el modelo de roles (ver "Método de acceso y roles (por evaluar)"): `generateId: "uuid"`, y sesiones y rate limit en la base de datos (etapa 1). Generar el esquema con el CLI de Better Auth y migrarlo con Drizzle.
- Primera ruta real de turnos: esquema, `zValidator`, `clientLoader` + `clientAction` con el cliente `hc`. Reemplazar `ping` y `/api/health`.
- Fijar versiones **exactas** de `react-router`, `@react-router/dev` y `@cloudflare/vite-plugin` (hoy tienen `^` en `package.json`) y declarar `engines` + `.nvmrc`.
- Reforzar con lint que `app/` no importe valores desde `workers/`.
- **Etapa 2:** Upstash, `secondaryStorage` y limitador por cuenta (ver "Plan por etapas").

**Los hace Josué:**

- Evaluar y decidir el método de acceso (¿solo Google?) y el modelo de roles (¿campo o plugin?). Si es Google: credenciales OAuth, pantalla de consentimiento y redirect URIs en Google Cloud.
- Neon: crear un rol dedicado `hyperdrive-user` con permisos mínimos (hoy se usa `fibonacci_owner`).
- Decidir el nombre final del repo.
- Cloudflare: conectar el repo a Workers Builds y limpiar las reglas de zona del intento anterior (no se confirmó que estén limpias).
- **Etapa 2:** Upstash: crear el Redis en la cuenta nueva (São Paulo). No hace falta en la etapa 1.
- Construir la sección "Precios" de la landing cuando llegue el momento.

## Convenciones

- Idioma de la interfaz y comentarios: español (Argentina).
- Commits en español, pequeños y descriptivos.
- Antes de agregar una dependencia: ¿es erasable-syntax friendly, mantenida y aburrida?
