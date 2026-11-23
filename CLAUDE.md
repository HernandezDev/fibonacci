# Fibonacci (3.er intento)

Sistema de reserva de turnos para clases particulares de matemática (Instituto Fibonacci, `fibonacci.com.ar`). Es el emprendimiento de un profesor de matemática, con la idea de poder sumar otros profesores. Es el **3.er intento, desde cero**.

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
| Auth | Better Auth 1.7.18: solo Google, roles con el plugin `admin` (`admin`, `profesor`, `alumno`; varios por usuario). Ver "Método de acceso y roles" |
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

- **Una carpeta por vista** en `app/routes/<vista>/`: el route module `<vista>.tsx`, y si hacen falta, `components/` y `hooks/` con lo que usa **solo** esa vista. Las carpetas `components/` y `hooks/` se crean cuando aparece el primer archivo (git no guarda carpetas vacías).
- Lo que comparten varias vistas va en `app/components/` (y `app/hooks/` si aparece un hook compartido). Si algo de una vista empieza a usarse en otra, se mueve ahí.
- Imports: dentro de la vista, relativos (`./components/...`, `../hooks/...`); lo compartido, con el alias `~/` (`~/components/Button`).
- `app/routes/landing/landing.tsx` es la ruta `/`: la **única** prerenderizada. Todo lo demás es SPA (ver "Prerender de la landing"). Sus componentes (`LandingHeader`, `MobileMenu`, `Diagonal-dash-background`) y el hook `use-active-section` (resalta la sección activa del menú) están en su carpeta.
- **Layout `spa`** (`app/routes/spa/spa.tsx`, sin URL): envuelve todas las rutas SPA en `routes.ts` (todo menos la landing). Su `clientMiddleware` obtiene la sesión con `obtenerSesion()` y la deja en `sesionContext`; su `clientLoader` la devuelve, y el componente monta el `LocaleProvider` con el usuario. Tiene `shouldRevalidate() { return true }` para que la sesión y el locale se actualicen en cada navegación entre hijas, y el único `HydrateFallback` ("Cargando…") de la primera carga, que heredan todas. Ver "Sesión en el cliente".
- Rutas SPA actuales: `home` (`/home`), `login` (`/login`), `perfil` (`/perfil`), `reservar` (`/reservar`) y `admin` (`/admin`, panel de administración). `/signIn` se borró: con Google, registrarse e iniciar sesión es lo mismo. Sus `clientLoader` leen la sesión con `context.get(sesionContext)` (no la piden) y redirigen: `/home` y `/perfil` sin sesión van a `/login`, y `/login` con sesión va a `/admin` si es admin y si no a `/home`.
- **Perfil** (`app/routes/perfil/perfil.tsx`, igual para alumno y profesor): nombre, país, zona horaria y formato de hora, guardados con `authClient.updateUser` (no pasa por Hono RPC) y validados en el servidor en `databaseHooks.user.update.before` con `editarPerfil` (`workers/validaciones/perfil.ts`). `pais` y `formatoHora` son `additionalFields` de `user` (`input: true`). El país sale de `Intl.DisplayNames` (`app/shared/regional.ts`): no hay lista guardada. `nombreDePais` (que usan el selector y `esPais`, así que el servidor y la lista coinciden) excluye los códigos viejos o alias (`SU`, `UK`, `YU`, etc.: `Intl.Locale` los normaliza al país actual y `DisplayNames` les daba el mismo nombre, por eso aparecían repetidos) y los que no son países (`NO_SON_PAISES`: agrupaciones, pseudolocales y los territorios de reserva excepcional de ISO 3166, como `AC`, `IC` o `TA`). Quedan 250, verificado en Node y en workerd. Se puede cambiar pero no borrar (sin opción "Sin especificar"); solo queda en `null` si Cloudflare no lo detectó al crear la cuenta, y entonces el selector muestra "Elegí tu país" deshabilitado. Zona horaria: la lista sale de `Intl.supportedValuesOf("timeZone")`, con la diferencia con UTC de hoy en la etiqueta (`(GMT-03:00) America/Buenos Aires`). Usa los nombres de CLDR, que no siempre son los de Cloudflare (`America/Buenos_Aires` y no `America/Argentina/Buenos_Aires`, y no trae `UTC`): la zona del usuario se suma a la lista si no está. Postgres (Neon, `pg_timezone_names`) conoce todas las de la lista, también las de nombre viejo. Igual que el país, se puede cambiar pero no borrar, y sin zona muestra "Elegí tu zona horaria" deshabilitado. Debajo dice "Todas las horas de la app se muestran en esta zona." `formatoHora`: `null` = automático. Al guardar llama a `olvidarSesion()`. Email y foto vienen de Google y no se editan. La foto se muestra con `perfil/components/Avatar` (pattern `circle` de Panda; sin foto o si no carga, el ícono de usuario; `referrerPolicy="no-referrer"` porque Google responde 403 a algunas con `Referer`). La foto se actualiza en cada inicio de sesión: `databaseHooks.account.update.after` (`workers/auth.ts`) lee `picture` del `idToken` nuevo y actualiza solo `user.image` si cambió. No se usa `overrideUserInfoOnSignIn` porque pisaría también el `name` elegido en el Perfil. Depende de que Better Auth actualice `account` al iniciar sesión (`updateAccountOnSignIn`, activo por defecto): si deja de hacerlo, la foto deja de actualizarse sin error.
- **Panel de administración:** `app/routes/admin/admin.tsx` es un layout (enlace a Inicio, menú de secciones con `NavLink` y `<Outlet />`). Su `clientLoader` manda a `/login` sin sesión y a `/home` sin rol `admin` (solo interfaz: la API decide), y `/admin` sin sección muestra solo el menú, sin pestaña marcada (el `<Outlet />` queda vacío). Cada sección es una ruta hija en `app/routes/admin/<seccion>/` y se suma en `routes.ts` y en la lista `secciones` de `admin.tsx`; Hoy: `materias` (`/admin/materias`, catálogo: lista y alta, con `clientLoader` + `clientAction` + `<Form>` sobre Hono RPC). `/home` muestra "Administración" solo a quien tiene el rol `admin`. La landing no muestra el acceso al panel a propósito: leer la sesión ahí haría que cada visita a `/` llame al Worker y a la base. `/login` muestra el botón de Google (`login/components/GoogleSignInButton`) y `/home`, la sesión y "Cerrar sesión". `/home` muestra "Reservar" solo si `puede(rol, { disponibilidad: ["listar"] })` (alumno o admin).
- **Reservar** (`app/routes/reservar/reservar.tsx`): turnos libres de los próximos 7 días, en `Card` con `tipo="turno"` dentro de `grid({ columns: { base: 1, md: 2, lg: 3 } })`. El `clientLoader` pide `api.turnos.disponibles.$get` **una sola vez y sin filtro** (con `controlarAcceso`; un error de la API se muestra en la página con `mensajeDeError`, no va al `ErrorBoundary`) y convierte `inicio` y `fin` a `Date`. Las materias del selector **salen de los mismos turnos** (sin repetir, por nombre): no hay otro endpoint. **El filtro por materia es en el cliente:** la materia elegida va en `?materia=<id>` (se comparte y sobrevive a una recarga) y la lee el componente con `useSearchParams`, no el loader; `shouldRevalidate` devuelve `false` cuando solo cambia la búsqueda (misma ruta, sin formulario), así que filtrar no vuelve a pedir la API. **Cada card es un turno de una sola materia** (título = la materia, subtítulo = el profesor), así el botón Reservar ya sabe qué reservar sin preguntar después y la card mide lo mismo aunque el profesor dé muchas materias. El selector arranca en "Todas las materias": ahí cada turno aparece **una vez por materia** que da el profesor (en `dev`, 85 cards para 32 turnos). Es una **maqueta**: con muchos profesores y materias van a ser demasiadas cards, y se va a resolver más adelante (filtros por día y horario, agrupar, paginar). La `key` es `profesor.id` + `inicio` + `materia.id` (un turno libre todavía no tiene `id`). Una materia de la URL que no está entre las de los turnos muestra "No hay turnos libres de esa materia…" con un enlace a todas. El botón "Reservar (próximamente)" está deshabilitado. Verificado con Chrome headless contra `dev` (alumno de prueba con cookie firmada, zona de Buenos Aires): "Todas" por defecto con 85 cards de una materia cada una, Geometría muestra solo los 11 de Laura, la URL cambia y vuelve a quedar limpia con "Todas", un solo pedido a la API al filtrar, recarga, 24 h (18:00) y 12 h (6:00 p. m.), una columna sin desborde a 375 px y el enlace en `/home`.
- Para sumar una pantalla: crear `app/routes/<vista>/<vista>.tsx` y registrarla en `app/routes.ts` (las rutas se declaran a mano, no por nombre de archivo). Es SPA salvo que se agregue a `prerender` a propósito. Los tipos siguen en `./+types/<vista>`.
- `app/components/`: `Button` y `Card` (ver "Componentes estilizados") y `Logo`, compartidos. `Logo` es un `Link` de React Router a `/` (sirve en cualquier pantalla, también en la SPA).
- `app/lib/`: `seo.ts` (helper `seo()` para el `meta` de rutas públicas), `preload.ts` (`preloadFonts()`, precarga de la fuente), `api.ts` (cliente `hc` de Hono RPC, más `controlarAcceso(res)`, que manda a `/login` con 401 y a `/home` con 403, y `mensajeDeError(res)`, que lee el `{ error }` de la API), `auth-client.ts` (cliente de Better Auth), `sesion.ts` y `locale.tsx`. Todo eso es solo del navegador.
- `app/shared/`: lo que importan **también** el Worker y el frontend: `permisos.ts` (roles y permisos) y `regional.ts` (país y formato de hora). **`workers/` solo importa de `app/shared/`**: un archivo de `app/lib/` arrastraría el cliente de Better Auth o de React Router al Worker, y TypeScript no lo marca. Desde `workers/` se importa con ruta relativa (`../app/shared/permisos`); desde `app/`, con `~/shared/...`.
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
- Cliente `pg` **por request** (no global) dentro del Worker. Requiere `nodejs_compat` en `wrangler.jsonc`. Se usa con `withDb(env, ctx, async (db) => ...)` de `workers/pg-client.ts`: abre la conexión, corre la función y recién después cierra con `ctx.waitUntil(client.end())`. **No** llamar a `client.end()` antes de consultar: `end()` se ejecuta al llamarlo, no al responder, y cierra el cliente antes de la consulta (`Client was closed and is not queryable`).
- `withDb` pide solo `Pick<ExecutionContext, "waitUntil">`: el `c.executionCtx` de Hono no es el mismo tipo que el `ExecutionContext` de Cloudflare.
- Rol: hoy se usa `fibonacci_owner`. Queda pendiente crear un **rol dedicado** (`hyperdrive-user`) con los permisos mínimos para la app.
- `wrangler.jsonc`: `vars` con `GOOGLE_CLIENT_ID` (público: viaja en la URL de Google), binding `HYPERDRIVE`, flag `nodejs_compat` y un `localConnectionString` **de relleno, sin credenciales reales**. Hace falta porque el build (prerender) y Workers Builds exigen una cadena local aunque no consulten la base. La real va en `.env`.
- Migraciones con `drizzle-kit` contra la URL **directa** de Neon (no Hyperdrive).
- Neon free: 10 ramas por proyecto, scale-to-zero a los 5 min (no se puede desactivar). Los miembros de la organización son ilimitados en free; roles Admin / Editor / Viewer / Collaborator, y no hay restricción por rama documentada.
- Evitar doble reserva con restricciones **a nivel base** (unique / exclusion constraint) más transacciones reales. `timestamp({ withTimezone: true })`, siempre en UTC.
- **Turnos** (`workers/db/turnos.ts`): `materia`, `profesor_materia`, `regla_disponibilidad` (horario semanal; cada regla es un turno reservable y las horas son de la zona horaria de su profesor (`user.zona_horaria`); al calcular turnos se convierten con `AT TIME ZONE` usando esa columna. Un profesor sin zona no ofrece turnos) y `turno`. La doble reserva la frena la exclusion constraint `turno_profesor_sin_solapamiento` (mismo profesor, rangos `[)` que se pisan, salvo cancelados), en la migración propia `drizzle/0003_turno_sin_solapamiento.sql` (`drizzle-kit generate --custom`), porque Drizzle no tiene `exclude()` y no la ve en el esquema: no borrarla ni repetirla. Usa `btree_gist`. Las filas con turnos no se pueden borrar (las FK protegen el historial), así que se desactivan: `materia.activo` (admin), `profesor_materia.habilitado` (admin: el profesor puede darla) y `profesor_materia.activo` (profesor: la ofrece; arranca en `false`, así el profesor activa de a poco lo que el admin le habilitó). Se reserva solo con las tres en `true`: la condición es `materiaReservable` (en `turnos.ts`), que se usa en el `.where()` de toda consulta que liste o reserve, sin repetir las tres comparaciones. Lo que la base no puede verificar lo hace el servidor: que `profesor_id` tenga el rol `profesor`, que el turno coincida con una regla, las tres columnas anteriores y quién puede cambiar cada una.
- Decisión sobre ramas: **no** se crean ramas de Neon automáticamente por PR. Si un compañero necesita una, se le da acceso para crearla cuando la necesite.
- Proyecto Neon `fibonacci` (sa-east-1), base `fibonacci`, Postgres **17**. Ramas: `production` (la por defecto, la usa Hyperdrive en Cloudflare) y `dev` (desarrollo y pruebas).
- **`DATABASE_URL` y la cadena local de Hyperdrive apuntan siempre a `dev`.** Las migraciones se aplican por rama: para migrar `production`, solo cuando un desarrollador lo pida, usar `npm run db:migrate:prod`, que corre `drizzle-kit migrate` con `drizzle.prod.config.ts` (igual que `drizzle.config.ts`, pero lee la cadena **directa** de la rama `production` de la variable `PROD_DATABASE_URL`). Antes de migrar, `scripts/confirmar-prod.ts` muestra el host (nunca usuario ni contraseña) y pregunta `¿Confirmar? (s/N)`: solo `s` sigue, Enter cancela, y sin terminal interactiva se niega. Va en un archivo aparte porque probamos ponerlo dentro de `drizzle.prod.config.ts` y no sirve: `drizzle-kit` carga la configuración como CommonJS (sin `await` de nivel superior) y la alternativa síncrona con `readSync` no deja escribir en la terminal real (devuelve vacío y cancela). No chequea que la cadena sea la de `production` ni que sea la directa: eso depende de lo que haya en `PROD_DATABASE_URL`. El orden en cada cambio de esquema: `db:generate`, `db:migrate` en `dev` y probar, commitear `drizzle/`, `db:migrate:prod` y recién después desplegar el código. Los cambios tienen que ser compatibles hacia atrás (primero agregar, después borrar), porque entre la migración y el deploy corre el código viejo contra el esquema nuevo.
- **Drizzle** (versión estable, exacta): `drizzle-orm` 0.45.4, `drizzle-kit` 0.31.11. Esquema en `workers/db/`, un archivo por tema: `auth-schema.ts` (tablas de Better Auth, generado; no se llama `auth.ts` para no confundirlo con `workers/auth.ts`), `sistema.ts` (`ping`) y, cuando exista, `turnos.ts`. `index.ts` reexporta todo y es lo que leen `drizzle.config.ts`, el adaptador de Better Auth y `withDb` (`import * as schema from "./db"`); un archivo nuevo de tablas hay que sumarlo ahí. Configuración en `drizzle.config.ts` (carga `.env` con `process.loadEnvFile()` en un `try`, porque en CI no existe). Scripts: `db:generate`, `db:migrate` y `db:studio`. **No usar `drizzle-kit push`.**
- **Datos de prueba de la oferta:** `npm run db:seed` (rama `dev`) y `npm run db:seed:prod` (pide confirmación, como `db:migrate:prod`) corren `scripts/seed.ts` con `tsx` (Node solo no resuelve los imports sin extensión de `workers/db`). Carga materias, profesores de prueba (`role: "profesor"`, emails `@profesores.fibonacci.invalid`, que nadie puede tener en Google, así que no pueden iniciar sesión), `profesor_materia` con `habilitado` y `activo` en `true`, y sus reglas. Los profesores de prueba tienen `zona_horaria` `America/Argentina/Buenos_Aires` (`ZONA_PROFESORES`): si ya existen, el seed les actualiza solo la zona. No crea alumnos ni turnos. Se puede repetir: busca por nombre y email, y reemplaza las reglas de esos profesores. Para sacarlos: `npm run db:seed:limpiar` (y `db:seed:limpiar:prod`, con confirmación) borra los turnos de esos profesores (la FK de `turno` no es en cascada), los profesores (en cascada, sus `profesor_materia` y reglas) y las materias de la lista del seed que nadie más usa. No toca alumnos ni materias cargadas desde el panel. `scripts/seed.ts` necesita `workers/db/**/*.ts` en el `include` de `tsconfig.node.json` (proyecto `composite`); funciona porque el esquema solo usa Drizzle, sin tipos de Cloudflare.
- **Drizzle Studio:** `npm run db:studio` (`drizzle-kit studio` con `drizzle.config.ts`, o sea la rama `dev`). Se abre en el navegador en **`https://local.drizzle.studio`**. Esa página se conecta a un servidor que el comando levanta en tu máquina (`127.0.0.1:4983`, no hace falta abrirlo), así que los datos no pasan por Drizzle. Si queda en "Drizzle Kit on localhost:4983", el navegador está bloqueando el acceso a `localhost`: en Chrome o Edge, permitir **Acceso a la red local** en la configuración del sitio; en Brave, bajar los escudos. Permite editar y borrar filas. **No hay script para producción a propósito:** `--config=drizzle.prod.config.ts` no pide confirmación, y para mirar producción es más seguro el SQL Editor de Neon.
- **Diagrama entidad-relación:** `npm run db:der` genera el DER con [Liam ERD](https://liambx.com/docs) (`@liam-hq/cli` 0.7.24, por `npx`, sin agregarlo a las dependencias) a partir de `workers/db/*.ts` y lo sirve en `http://localhost:3000` con `serve` 14.2.7. Lee los archivos de Drizzle, no la base, así que no necesita credenciales; refleja el esquema del código, que puede ir adelante de una rama sin migrar. La salida va a `.der/` (en `.gitignore`): sin `--output-dir`, el CLI crea `dist/` en la raíz. El soporte de Drizzle es experimental; verificado que lee las 6 tablas sin duplicar las que reexporta `index.ts`. La versión web (`liambx.com/erd/p/...`) no sirve porque el repo es privado.
- La carpeta `drizzle/` se **commitea completa, `drizzle/meta` incluida**: el `_journal.json` es la lista ordenada de migraciones que lee `migrate`, y los snapshots son lo que compara `generate`. Cada `db:generate` se commitea junto con el cambio de esquema en `workers/db/`.
- **IDs: UUID v4** (`uuid().primaryKey().defaultRandom()` en Drizzle, `gen_random_uuid()` en SQL). Con PG17 no hay `uuidv7()` (es nativo desde PG18). Validar con `z.uuid()`. No son un reemplazo del control de acceso: **cada ruta tiene que verificar en el servidor que el recurso pertenece al usuario de la sesión**. Todas las tablas llevan `created_at` con `timestamp({ withTimezone: true })` y `defaultNow()`.
- Está en revisión pero **no se usa** el soporte de `RETURNING OLD/NEW` de PG18 (PR #6568 de Drizzle, sin mergear y solo para PG18).
- **Turnos libres:** `GET /api/turnos/disponibles` (`workers/routes/turnos.ts`), con el permiso `disponibilidad: ["listar"]` (roles `alumno` y `admin`). Devuelve los turnos libres **desde ahora hasta dentro de 7 días** (no "lunes a domingo": así no depende de ninguna zona y siempre muestra una semana entera), ordenados por hora: `[{ inicio, fin, profesor: { id, nombre }, materias: [{ id, nombre }] }]`, con `inicio` y `fin` en ISO UTC. `?materiaId=<uuid>` filtra por materia. Se calcula en una sola consulta: por cada regla, los días de la ventana en el calendario del profesor (`generate_series` desde `(now() AT TIME ZONE zona)::date`), `fecha + hora AT TIME ZONE zona_horaria` para pasar a instante, y las materias con `materiaReservable` (`json_agg`). Quedan afuera: profesores sin zona, sin el rol `profesor` (con la misma comparación con comas de los roles) o baneados; sin ninguna materia reservable; turnos que ya empezaron o que se pisan con un turno no cancelado (mismo `tstzrange [)` que la exclusion constraint); y el propio usuario de la sesión. En `db.execute`, Drizzle no convierte las columnas (desactiva los parsers de fechas de `pg`): `timestamptz` llega como texto de Postgres, por eso la consulta las pide con `to_json(...) #>> '{}'` (ISO) y la ruta las normaliza con `toISOString()`. Probado contra `dev` corriendo `workers/api.ts` en Node con una cookie firmada (`serializeSignedCookie` de `better-call`; hace falta el header `Host`, que en Node no viene solo): lista, filtro, reservado/cancelado, profesor sin zona o sin materias activas, 401, 403 (solo `profesor`) y 400.
- La tabla `ping` se conserva (decisión del equipo); el endpoint `/api/health` se borró al sumar `/api/materias`, que ya prueba la conexión de punta a punta.

### Hyperdrive en desarrollo local

Variable en `.env` (la lee el plugin de Cloudflare):

```
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://usuario:password@host:5432/db
DATABASE_URL=postgres://...   # URL directa de Neon, para drizzle-kit
```

- El sufijo es el **nombre del binding** (`HYPERDRIVE` acá).
- La URL **debe incluir contraseña** o falla con un error de validación (ZodError).
- Localmente no hay pooling ni caché. Verificado de punta a punta contra un Postgres local y contra la rama `dev` de Neon (en su momento con `/api/health`, hoy borrado; ahora lo prueba `/api/materias`).
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

### Método de acceso y roles

**Decidido: solo Google, con el plugin `admin` de Better Auth (`better-auth` 1.7.18, exacta).** Implementado en la rama `feat/auth-google`.

- Usuarios: alumnos, profesores y administradores. Un usuario puede tener **varios roles** (por ejemplo, admin y profesor).
- Por qué Google: no hay contraseñas que guardar ni hashear (se evita el costo de CPU de scrypt en Workers Free), no hace falta un servicio de correo para verificación y recuperación, y hay menos superficie de ataque. En contra: quedan afuera quienes no tengan cuenta de Google (por ejemplo, alumnos menores) y se depende de un tercero. Si aparecen, se suma email y contraseña (Better Auth vincula las cuentas por email verificado). Las secciones "Hashing en Workers" y el limitador por cuenta de la etapa 2 aplican **solo si se usa email y contraseña**.
- Por qué `admin` y no `organization`: hay un solo instituto. `admin` trae el campo `role` en `user`, varios roles por usuario (guardados separados por comas: `"admin,profesor"`) y endpoints para que el admin gestione usuarios desde la app (`setRole`, `listUsers`, `banUser`, `revokeSessions`). `organization` sirve para varias organizaciones separadas; reconsiderarlo solo si cada profesor pasa a funcionar como un instituto aparte.

**Implementación**

- `workers/auth.ts`: `createAuth(env, db)`, **por request** dentro de `withDb` (igual que el cliente `pg`). Adaptador de Drizzle, Google como único proveedor (`prompt: "select_account"`), `rateLimit: { enabled: true, storage: "database" }`, `generateId: "uuid"` y `cf-connecting-ip`.
- `baseURL` dinámica con `allowedHosts`: `fibonacci.com.ar`, `fibonacci.josuehernandezrivas.workers.dev` y `localhost:5173`. La URL base sale del host del request solo si está en la lista; los orígenes de confianza (CSRF) se derivan de ahí. Un host nuevo (otro dominio, un alias de preview) hay que sumarlo acá **y** como redirect URI en Google.
- `workers/api.ts` monta `/api/auth/*` (GET y POST) con `auth.handler(c.req.raw)`.
- `app/shared/permisos.ts`: el catálogo de permisos (recurso → acciones, por ejemplo `materia: ["listar", "crear"]`, más los `defaultStatements` del plugin), `ac`, `roles` (`admin`, `profesor`, `alumno`) con lo que tiene cada uno, el tipo `Permisos` (una acción fuera del catálogo es error de tipos) y `puede(role, permisos)`. Está en `app/shared/` porque lo usan el servidor y el cliente, y el frontend no puede importar valores de `workers/`. Los permisos nuevos se suman ahí.
- `puede(role, permisos)` evalúa con `roles[r].authorize(...)`, el evaluador que `auth.api.userHasPermission` corre por dentro (no está documentado): síncrono, sin consultar la base y con varios roles (`rolesDe` pasa `"admin,profesor"` a una lista tipada). En el servidor decide; en el cliente solo muestra u oculta cosas.
- **`auth.api.userHasPermission` se probó en `conSesion` y se sacó.** Sin headers (variantes `role` y `userId`) falla con 500: la `baseURL` dinámica necesita el host del request (`Dynamic baseURL could not be resolved for this direct auth.api call`). Con headers relee la sesión de la base y no devuelve el usuario. La otra salida, `baseURL.fallback`, no se tomó: también se aplica a los hosts que no están en `allowedHosts`, que hoy se rechazan. Vale para cualquier `auth.api.*` sin headers.
- **Sesión en la API: `conSesion(permisos?)`** (`workers/sesion.ts`), middleware de Hono para toda ruta no pública: `conSesion()` exige sesión y `conSesion({ materia: ["crear"] })`, además, el permiso. Abre **una** conexión con `withDb` para todo el request: lee la sesión con `auth.api.getSession` (vencida, revocada o baneada = `null` → 401), evalúa el permiso con `puede` (→ 403) y deja `c.var.db` y `c.var.usuario` a la ruta. Sesión y permiso van en un solo middleware para que no se puedan usar en el orden equivocado. Que el recurso sea del usuario (por ejemplo, una regla de ese profesor) lo verifica la ruta. El RPC no incluye los 401/403 del middleware en los tipos de la respuesta: el cliente los mira con `controlarAcceso`.
- **Datos regionales de Cloudflare:** el middleware `conDatosRegionales` (`workers/auth.ts`, solo en `/api/auth/*`) lee `cf.country` y `cf.timezone` del request y deja cada uno en `c.var` solo si es válido (`esPais` y `esZonaHoraria` de `app/shared/regional.ts`); si no, `undefined`. `handleAuth` y `createAuth` los reciben como `{ pais, zonaHoraria }`. Al crear la cuenta (`databaseHooks.user.create.before`) se guarda lo que esté completo; lo que falte queda en `null` y se completa en el siguiente inicio de sesión (`databaseHooks.session.create.before`: una sola consulta con `COALESCE` en cada columna y `WHERE … AND (pais IS NULL OR zona_horaria IS NULL)`). Un valor ya guardado **no se pisa nunca**. En local, Miniflare trae los `cf` de tu conexión (o no los trae): sin ellos la cuenta se crea igual, con `null`.
- **`zonaHoraria`** (`user.zona_horaria`, nombre IANA como `America/Argentina/Buenos_Aires`): `additionalFields` con `input: true`. Arranca con la de Cloudflare y el usuario la cambia en el Perfil; se valida con `esZonaHoraria` en `editarPerfil`. Es la zona en la que se interpretan las reglas de disponibilidad de un profesor, y la zona en la que la app le muestra las horas a cada usuario (`LocaleProvider`; ver "Fechas y horas"). Se eligió la del Perfil y no la del navegador para que las horas no dependan del dispositivo: si Cloudflare la adivinó mal (por ejemplo, con una VPN), el usuario la corrige en el Perfil. No hay aviso cuando no coincide con la del dispositivo (se puede sumar si hace falta).
- `defaultRole: "alumno"`: todo el que entra con Google arranca como alumno. `adminRoles: ["admin"]`.
- **Primer admin:** se pone a mano en la base, una vez, después de que la persona inicie sesión: `UPDATE "user" SET role = 'admin,profesor' WHERE email = '...';`. Desde ahí el admin promueve a los demás con `authClient.admin.setRole({ userId, role: ["profesor"] })`.
- Esquema: `workers/db/auth-schema.ts`, generado con `npx auth@1.7.18 generate --output workers/db/auth-schema.ts` y reexportado desde `workers/db/index.ts`. Tablas `user`, `session`, `account`, `verification` y `rate_limit`, con IDs `uuid`. Retoque a mano: los `timestamp` llevan `withTimezone: true` (reaplicarlo si se regenera). El CLI necesita un archivo que exporte `auth`: se usó uno temporal que llama a `createAuth` con un `env` de relleno y `drizzle.mock()` (debe estar dentro del proyecto para resolver los paquetes). `rate_limit` no tiene `created_at`: es de uso interno de Better Auth.
- Cliente: `app/lib/auth-client.ts`, `createAuthClient` de `better-auth/react` con `adminClient({ ac, roles })`, que suma `role` y `banned` al tipo de la sesión. En la 1.7, `createAuthClient` **no** recibe el tipo del servidor.
- Interfaz: `GoogleSignInButton` (`app/routes/login/components/`, solo lo usa `/login`) llama a `authClient.signIn.social({ provider: "google", callbackURL: "/home" })`. No hay pantalla de registro aparte: con Google, si la cuenta no existe, Better Auth la crea. `/home` muestra la sesión, los roles y "Cerrar sesión" (`cerrarSesion()` de `app/lib/sesion.ts` y después navega a `/login`). Las redirecciones del `clientLoader` solo deciden qué pantalla mostrar: la API igual verifica la sesión en cada ruta.
- Secretos: `BETTER_AUTH_SECRET` y `GOOGLE_CLIENT_SECRET`. `GOOGLE_CLIENT_ID` no es secreto y está en `vars` de `wrangler.jsonc` (si también está en `.env`, en local gana el `.env`). En local los secretos van en `.env`; en producción, como secretos del Worker (panel o `npx wrangler secret put <NOMBRE>`, que pide el valor por consola). El `BETTER_AUTH_SECRET` local es distinto del de producción.
- Google Cloud: cliente OAuth "Fibonacci - Better Auth", redirect URIs `http://localhost:5173/api/auth/callback/google`, `https://fibonacci.com.ar/api/auth/callback/google` y `https://fibonacci.josuehernandezrivas.workers.dev/api/auth/callback/google`. Permisos `openid`, `email`, `profile`. La pantalla de consentimiento ya está en **"Production"** (comprobado: entran emails que nunca se cargaron como usuarios de prueba). Cualquiera con cuenta de Google puede iniciar sesión, en producción y en las previews, y queda creado como `alumno` (`defaultRole`). Hoy eso no da acceso a nada sensible: lo de administración lo verifica el servidor por rol. Si más adelante no se quiere registro abierto (por ejemplo, solo alumnos invitados), Better Auth permite desactivar el alta automática: decidirlo al diseñar los turnos.
- **Login en las previews con `oauth-proxy`** (rama `feat/oauth-proxy-previews`). Google no acepta comodines en las redirect URIs y cada preview tiene otra URL, así que la preview usa la redirect URI de producción: manda a Google con `redirect_uri=https://fibonacci.com.ar/api/auth/callback/google` y un `state` cifrado; producción canjea el código, cifra perfil y tokens (vencen a los 60 s) y redirige a la preview, que crea el usuario y la sesión en **su** base (`dev`). Producción no escribe nada en su base ni necesita confiar en las URLs de las previews: la URL de vuelta viaja cifrada y solo la acepta si la puede descifrar.
  - URLs de las previews: por rama `https://<rama con / → ->-fibonacci.josuehernandezrivas.workers.dev` (ej. `feat-oauth-proxy-previews-fibonacci...`) y por deploy `https://<8 hex>-fibonacci...`. Patrón `*-fibonacci.josuehernandezrivas.workers.dev` (no incluye el `workers.dev` de producción). Se suma a `allowedHosts` **solo dentro de una preview**.
  - Dos variables, en `workers/auth.ts` como `ProxyEnv` (no están en el `.env`, por eso no salen en el `Env` generado): `OAUTH_PROXY_SECRET` (secreto, **el mismo valor** en producción y en las previews; sin él no se carga el plugin, como en local) y `OAUTH_PROXY_PRODUCTION_URL` (solo en `previews.vars`; es lo que activa el desvío). Con el plugin y sin `productionURL`, la `baseURL` dinámica coincide con el request y no se desvía nada: producción solo atiende la vuelta.
  - Las previews tienen `vars` propias (`previews.vars`: `GOOGLE_CLIENT_ID` y `OAUTH_PROXY_PRODUCTION_URL`) y secretos propios en el *base config* (`wrangler preview base-config secret put`, beta abierta): `OAUTH_PROXY_SECRET`, `GOOGLE_CLIENT_SECRET` y un `BETTER_AUTH_SECRET` **distinto** del de producción.
  - Orden: desplegar el plugin y cargar `OAUTH_PROXY_SECRET` en **producción** antes de probar una preview. Sin `BETTER_AUTH_SECRET` en las previews, `/api/auth/*` da 500 (Better Auth falla en vez de usar un secreto por defecto).
  - Las previews son públicas y escriben en la rama `dev` de Neon. Decidido cerrarlas con Cloudflare Access e ingreso por GitHub: ver "Pasos pendientes".
  - **El endpoint receptor está cerrado fuera de las previews.** El plugin agrega `/callback/:id/oauth-proxy` (y el viejo `/oauth-proxy-callback`), que crea una sesión a partir de un perfil cifrado con `OAUTH_PROXY_SECRET`. En producción no hace falta y era peligroso: el secreto está en las previews, que corren código de cualquier rama, así que quien pueda pushear puede leerlo (`c.env.OAUTH_PROXY_SECRET`) y armar un perfil con el email de otro (por ejemplo, el admin) para entrar a producción. Un `hooks.before` en `workers/auth.ts` responde 404 en esas rutas cuando falta `OAUTH_PROXY_PRODUCTION_URL` (producción, por el dominio o por `workers.dev`, y local). Compara la ruta ya resuelta por Better Auth, no la URL: `disabledPaths` se descartó porque compara la URL literal. Verificado en local: en modo producción, las variantes (`/callback/google/oauth-proxy`, con barra final, con otro proveedor y `/oauth-proxy-callback`) dan 404 y el callback normal sigue respondiendo; en modo preview el receptor sigue funcionando.
  - **Destino del reenvío validado.** La URL a la que producción reenvía el perfil sale del `state`, y quien tenga el secreto la elige completa (cualquier sitio y ruta): podría llevarse el perfil de Google (nombre, email, foto y tokens `openid email profile`) de quien abra un enlace armado. `handleAuth` (`workers/auth.ts`, usado por `workers/api.ts`) revisa el header `Location` de **toda** respuesta de Better Auth y solo deja pasar el mismo sitio, `https://accounts.google.com` (el inicio de sesión manda un `Location` hacia Google además del JSON) y `https://*-fibonacci.josuehernandezrivas.workers.dev`; si no, redirige a `/api/auth/error?error=invalid_redirect`. Se valida la respuesta final y no el `state`, para no depender de cómo cifra el plugin por dentro. Probado con `destinoPermitido` (13 casos: sufijo en la ruta, `...workers.dev.evil.com`, `http://`, `user@evil.com`, etc.) y en local el login, el callback y `get-session` siguen iguales. Límite: cualquier Worker de la cuenta cuyo nombre termine en `-fibonacci` pasa la validación.
  - Verificado en local simulando los tres modos con `CLOUDFLARE_INCLUDE_PROCESS_ENV=true` (suma las variables de la terminal al Worker sin tocar el `.env`): sin secreto, login local normal (`state` de 32 caracteres); con secreto y sin URL de producción, el plugin está cargado (`/callback/google/oauth-proxy` responde) pero no desvía; con las dos, `redirect_uri` de producción y `state` cifrado (~1666 caracteres). **No verificado:** el recorrido completo con Google en una preview real. En local no se pueden probar hosts ajenos: Vite los bloquea antes del Worker.
- Verificado en local contra la rama `dev`: `/api/auth/ok` responde, `get-session` devuelve `null` sin sesión, `sign-in/social` arma la URL de Google con la `redirect_uri` correcta, y se rechazan un origen ajeno (`INVALID_ORIGIN`, solo cuando el request trae cookies) y una `callbackURL` externa (`INVALID_CALLBACK_URL`). Con el build: el rate limit responde 429 al cuarto intento de ingreso, `/login` responde y `/signIn` da 404. El login completo con Google se probó en producción y funciona.

### Hashing en Workers

> Aplica solo si se usa email y contraseña (ver "Método de acceso y roles").

- Better Auth usa por defecto scrypt (N=16384, r=16, p=1, dkLen 64). Desde la 1.6 usa `node:crypto` nativo; desde better-auth >= 1.7.11 / @better-auth/utils 0.5.0 hay una condición de export `workerd` hacia la versión nativa.
- Medido en workerd: scrypt nativo ~100 ms de CPU, scrypt en JS (noble) ~200 ms, PBKDF2 WebCrypto 100k iteraciones ~55 ms (20k ~14 ms, 10k ~8 ms). PBKDF2 tiene tope de 100k en producción.
- El scrypt nativo de workerd es síncrono dentro de una Promise, así que **cuenta como CPU** igual que el de JS.
- Free: 10 ms de CPU por request, y un hash de ~100 ms puede pasar de forma esporádica por el "built-in flexibility" pero no es confiable. **Plan Workers Paid** (hasta 5 min de CPU) hace que los defaults de Better Auth alcancen. Error 1102 = límite de CPU.
- Las esperas de I/O (Redis, DB) no cuentan como CPU.

### Auth, etapa 1: sin Redis

- Límites por defecto de Better Auth, por IP y ruta: 100 req/10 s en general; `/sign-in/*`, `/sign-up/*`, `/change-password` y `/change-email`, 3/10 s. Al pasarse responde 429 con `X-Retry-After`. Solo cubre `/api/auth/*`, no el resto de la API.
- **`enabled: true` es obligatorio en Workers.** Por defecto Better Auth lo activa solo si `NODE_ENV === "production"`, y en un Worker `NODE_ENV` no existe: sin esa opción queda **apagado también en producción**. Comprobado con el build (`vite preview`): sin `enabled` los 5 pedidos a `/sign-in/social` dieron 200; con `enabled: true` dieron `200 200 200 429 429`, `get-session` siguió en 200 y a los 11 s volvió a 200. Se descartó definir `NODE_ENV=production` en `wrangler.jsonc` porque cambia el comportamiento de otras librerías. Efecto secundario: el límite también se aplica en desarrollo.
- La tabla `rate_limit` guarda una fila por `key` (`<ip>|<ruta>`, por ejemplo `127.0.0.1|/sign-in/social`) con `count` y `last_request` (epoch en ms). Suma con un `UPDATE ... WHERE count < max` atómico y borra sola las filas vencidas.
- Su almacenamiento por defecto es en memoria, que en Workers no se comparte entre las instancias del Worker y por eso no sirve como protección real. Usar la base de datos:

```ts
betterAuth({
  rateLimit: { enabled: true, storage: "database" },
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
    enabled: true, // en Workers no hay NODE_ENV: ver "Auth, etapa 1"
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
- Free plan actual. Hyperdrive `fibonacci-db` ya está creado (ver "Base de datos"). La app ya está conectada a su dominio (confirmado por el equipo).

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

- Cada ruta valida con `validar(target, esquema)` (`workers/validaciones/campos.ts`): es `zValidator` (`@hono/zod-validator`) con un hook que, si los datos no pasan, responde 400 con `{ error }` (el primer problema) en vez del `ZodError` completo, para que todos los errores de la API tengan la misma forma. El archivo de la API exporta `export type AppType = typeof app`.
- El frontend llama con `hc<AppType>("/")`: rutas, `param`, `query`, `json` y la respuesta quedan tipados, y un cambio en el servidor rompe el `typecheck` del frontend.
- Los esquemas de Zod viven **solo en el servidor**, en `workers/validaciones/<módulo>.ts` (hoy `turnos.ts`). El cliente no valida con Zod (no llega al bundle): recibe el tipo de cada entrada por Hono RPC y los errores los da la API. Si un formulario necesita errores por campo antes de enviar, se mueve **ese** esquema a `app/shared/`: es posible porque los archivos de validaciones importan las tablas con `import type` (solo las usan en `CamposDe<typeof tabla>`), así que en ejecución dependen solo de Zod. Costo medido con Vite: ~26 KB gzip (109 KB minificado) en el chunk de las rutas que lo importen, no en la landing.
- Se escriben **a mano**, guiados por la tabla: `z.object({ ... } satisfies CamposDe<typeof turno>)` (`workers/validaciones/campos.ts`). El editor autocompleta las columnas y el typecheck falla si un campo no existe o no da el tipo de su columna. Cada esquema lleva solo lo que el cliente puede mandar: lo que sale de la sesión (`alumnoId`) o lo pone la base (`id`, `estado`, `created_at`) no se acepta, y Zod descarta las claves que no declara. Se descartó `drizzle-zod`: no suma protección (el insert tipado de Drizzle y las constraints ya frenan las inconsistencias), oculta lo que valida y obliga a recordar `.pick()` y a corregir las fechas (`timestamp` → `z.date()`, que rechaza el texto del JSON).
- Fechas: `z.iso.datetime({ offset: true }).transform((s) => new Date(s))`. El cliente manda texto ISO con zona (el RPC lo tipa como `string`) y la ruta recibe un `Date`. Horas de las reglas: `HH:MM` sin segundos (`z.iso.time({ precision: -1 })`), para compararlas como texto; Postgres las devuelve como `HH:MM:SS`, así que la API las recorta al responder. Los `check` de la base se repiten en Zod solo para dar un error claro. Los mensajes de Zod salen en español: `campos.ts` hace `z.config(es())` importando solo `zod/v4/locales/es.js` (`z.locales` arrastraría todos los idiomas).
- Encadenar las rutas (`new Hono().basePath("/api").get(...).post(...)`) para que la inferencia funcione, con `strict: true`. **Un sub-router por tema en `workers/routes/`** (hoy `materias.ts` y `turnos.ts`, que exporta un `new Hono<{ Bindings: Env }>()` encadenado), montado en `workers/api.ts` con `.route("/materias", materias)`. `/api/auth/*` queda en `api.ts`. Verificado: con `.route()` el cliente sigue tipado (`api.materias.$get()` devuelve `nombre: string`, `activo: boolean`, y `$post` sin `nombre` es error de tipos).
- Versiones fijas (estables, exactas): `hono` 4.13.15 (la v5 sigue en release candidate), `@hono/zod-validator` 0.9.1, `zod` 4.6.7. Verificado: el tipo de la respuesta llega al cliente (ver sub-routers).
- `workers/api.ts` define `.notFound(...)` para que las rutas inexistentes bajo `/api` devuelvan JSON (`{ "error": "No encontrado" }`, 404) y no texto plano.
- Las rutas **GET son de solo lectura**; las escrituras van en POST / PUT / DELETE.
- `@hono/cli` se probó y se descartó: la 0.1.11 (`latest`) solo tiene `request`, y empaquetar `workers/api.ts` falla por `pg` (`Dynamic require of "events"`). La documentación describe la 1.0 rc, y en esa solo anduvo `--runtime vite`, que equivale a un `curl` contra `npm run dev`. Reevaluar cuando salga la 1.0 estable o si la API crece. Mientras tanto, probar con `npm run dev` y `curl`.
- Es HTTP normal: las rutas siguen siendo URLs y métodos comunes. El RPC **no valida las respuestas en runtime**; es solo una garantía de tipos. Chequear siempre `res.ok`: los errores de estado y de red no vienen tipados.

**Better Auth**

- Cliente con `createAuthClient` y los plugins de cliente (`adminClient`), que suman los campos de la sesión (`role`). En la 1.7 no recibe el tipo del servidor como genérico; para campos propios en `user` se usaría `inferAdditionalFields<Auth>()` con `import type`.
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

**Estilos reutilizables** (`theme.extend` de `panda.config.ts`, después de `semanticTokens`):

- `textStyles`: tipografía, solo tamaño, peso y altura de línea (el color va aparte, con los roles). `titulo` (`lg`, `semibold`, 1.4) y `detalle` (`sm`, 1.5). Uso: `css({ textStyle: "titulo", color: "heading" })`.
- `layerStyles`: superficies para cards, casillas del calendario y el panel del Drawer. `superficie.elevada` (fondo blanco, borde `border`, sombra `sm`) y `superficie.apagada` (fondo `bg.muted`, borde transparente, así mide lo mismo que la elevada). Uso: `css({ layerStyle: "superficie.elevada" })`.
- Al cambiarlos, correr `npx panda codegen` (los tipos de `textStyle` y `layerStyle` salen de ahí).

**`Card`** (`app/components/Card.tsx`): card de un turno o de una clase, con el mismo patrón que `Button` (receta sin exportar, `className` desde afuera, sin `display` en la receta; el orden interno lo dan `vstack` y `hstack`). La receta solo elige superficie: variante `tipo`:

- `turno` (por defecto): turno libre, se puede tocar para reservar. `superficie.elevada` y sombra `md` al pasar el mouse.
- `clase`: clase tomada o pasada, solo informa. `superficie.apagada`.

Props: `titulo` (la materia), `subtitulo` opcional (el profesor para el alumno, el alumno para el profesor), `inicia` y `termina` (`Date`), y `acciones` opcionales (por ejemplo, el botón Reservar), más los atributos de `<article>` salvo `title`. La fecha y la hora salen de `useLocale()` (`fecha` y `hora`: español, formato de hora del Perfil, del país o del navegador, en la zona del Perfil o, si no tiene, la del navegador), dentro de un `<time dateTime>` con cifras tabulares. Por usar `useLocale()`, solo funciona dentro de las rutas SPA. La API manda texto ISO: convertirlo con `new Date(...)` antes de pasarlo.

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
- Los errores los da la API (`{ error }`) y el `clientAction` los devuelve para mostrarlos junto al formulario (`mensajeDeError`). Los esquemas de Zod viven en el servidor (ver "Tipos compartidos").
- La cookie de sesión de Better Auth viaja sola porque `hc("/")` apunta al mismo origen.
- **Sesión en el cliente** (`app/lib/sesion.ts`): ninguna ruta llama a `authClient.getSession()` directo. El middleware del layout `spa` llama a `obtenerSesion()`, que la guarda en memoria **5 minutos** (sin pedido mientras no venza; dos navegaciones seguidas comparten el pedido; un error no se guarda) y la deja en `sesionContext`. Los `clientLoader` la leen con `context.get(sesionContext)` y redirigen desde ahí si falta; los componentes, con `useSesion()`. Una sesión vieja como mucho muestra una pantalla de más: la API la verifica en cada llamada.
- Después de todo lo que cambie la sesión o el usuario (guardar el Perfil, un 401 o 403 de la API, que ya lo hace `controlarAcceso`), `olvidarSesion()`: la próxima navegación la vuelve a pedir. Cerrar sesión siempre con `cerrarSesion()`, no con `authClient.signOut()` directo, o la interfaz seguiría mostrando la sesión hasta que venza. Iniciar sesión no lo necesita: Google vuelve con una carga completa.
- **Fechas y horas:** `useLocale()` (`app/lib/locale.tsx`) devuelve `locale` y los formateadores `fecha` y `hora`, ya armados. El `LocaleProvider` lo monta el layout `spa` con el usuario de la sesión (no pide nada). Idioma siempre español (`es-<PAÍS>`); formato de hora: el del Perfil, si no 24 h en los países de `PAISES_FORZAR_24_HORAS` (hoy `AR`), si no el del navegador; zona horaria: la del Perfil (`zonaHoraria`, validada con `esZonaHoraria`) y, solo si el usuario no tiene, la del navegador; `useLocale()` también devuelve `zona`, para que cálculos propios (por ejemplo, qué día es un turno) usen la misma que se muestra. Cambiar la zona o el formato en el Perfil se ve sin recargar: el `clientAction` llama a `olvidarSesion()`, React Router vuelve a correr los loaders y el provider recibe el usuario nuevo. Fuera de las rutas SPA, `useLocale()` tira error. Un formato que se use mucho se suma al `useMemo` del provider en vez de crearlo en cada render.
- Estado de pantalla: `useState` para lo local y `useSearchParams` (la URL) para filtros que se quieran compartir o recargar.
- Los datos del servidor **no** se copian a un store.

**Qué se descarta por ahora y cuándo reconsiderarlo**

- **Zustand:** solo si hay estado de interfaz que muchos componentes lejanos necesiten y que no quepa en `useState`, la URL o un contexto (por ejemplo un borrador de reserva que sobrevive entre rutas distintas).
- **TanStack Query:** solo si se necesita caché en el cliente, mostrar datos viejos mientras se actualizan, polling (por ejemplo de disponibilidad) o actualizaciones optimistas. Se lleva bien con `hc`: se usa dentro de `queryFn`.
- Signals se descartó.
- Agregar una librería más adelante es fácil; sacarla cuando ya está en todos lados cuesta más.

Implementado en `/admin/materias` (`app/routes/admin/materias/materias.tsx`): el `clientLoader` llama a la API y deja que ella decida el acceso (`controlarAcceso`), el `clientAction` devuelve `{ error }` o `{ creada }`, `useNavigation()` deshabilita el botón mientras guarda y React Router recarga la lista sola. Verificado con `curl` contra `dev`: sin sesión y con una cookie inventada `/api/materias` da 401, `/api/health` da 404 y `/api/auth/ok` sigue en 200. No verificado: el recorrido en el navegador con sesión (crear, repetir → 409, nombre vacío → 400).

## Contexto académico

La materia de desarrollo web usa React Router como librería; usarlo como framework demuestra dominio igual. Este proyecto sirve también como práctica de portfolio.

## Pasos pendientes

**Hecho:** bootstrap con la plantilla, `ssr: false` + prerender de `/`, Panda, SEO de la landing, Neon (proyecto, ramas `production` y `dev`), Hyperdrive sin caché, Drizzle + `pg` con `withDb`, migración inicial (`ping`), Hono en `/api/*` con Hono RPC tipado, la app conectada al dominio y Better Auth con Google y el plugin `admin`, migrado y desplegado en producción.

**Los hace Claude:**

- **Login en las previews:** implementado con `oauth-proxy` en `feat/oauth-proxy-previews` (ver "Método de acceso y roles"). Falta probarlo con una preview real después de desplegarlo en producción. Alternativa descartada por ahora: una sola preview fija con su propia redirect URI en Google (más simple, pero solo esa preview tendría login).
- Turnos, siguiente paso: con `/materias` andando (falta que un desarrollador la pruebe en el navegador con una cuenta admin), seguir con habilitar materias a profesores, que el profesor las active, sus reglas y la reserva. Cada uno: permisos en `permisos.ts`, sub-router en `workers/routes/`, esquema en `workers/validaciones/` y vista.
- **Fijar versiones exactas de las dependencias clave** (hoy tienen `^` en `package.json`) y declarar `engines` + `.nvmrc`. Criterio: es **clave** si una actualización sin notar puede romper producción, tocar datos o seguridad, o desincronizarse con otra que va a la par; es **auxiliar** si solo afecta el desarrollo o algo visible que se nota enseguida.
  - Falta fijar: `react-router` y `@react-router/dev` (misma versión), `@cloudflare/vite-plugin` y `vite` (el prerender depende de la combinación de los cuatro), `wrangler` (despliegue y previews en beta) y los cuatro `@pandacss/*` (misma versión, v2 reciente).
  - Ya fijas: `better-auth`, `drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`, `hono`, `@hono/zod-validator` y `zod`.
  - Quedan con rango (auxiliares): `tsx` (solo el seed; comparte copia con `drizzle-kit`, que pide `^4.21.0`), `@types/node` (`^22`), `@types/react`, `@types/react-dom`, `react`, `react-dom`, `@fontsource-variable/inter`, `@phosphor-icons/react` e `isbot`.
  - `typescript`: pasar a `~6.0.3` (rama 6, solo parches), porque no sigue semver y una versión menor puede romper el `typecheck`. Probado: `tsc -b --force` pasa con 5.9.3, 6.0.3 y 7.0.2 (nov. 2026), Drizzle incluido. Se eligió la 6 y no la 7 (`latest`) por prudencia: la 7 es nativa (Go), salió en julio de 2026 y solo tiene dos parches. Nada del proyecto la impide hoy: Drizzle no declara versión de TypeScript ni usa su API, y ningún paquete usa la API clásica de JavaScript que la 7 ya no trae. Revisarlo si se suma un lint que la necesite (por ejemplo `typescript-eslint`; hoy no hay lint).
- Reforzar con lint que `app/` no importe valores desde `workers/`, y que `workers/` solo importe de `app/shared/`.
- **`typecheck` antes de cada commit, para todos:** Husky (`--save-exact --save-dev`), `"prepare": "panda codegen && husky"` (corre con `npm install` / `npm ci`, así el hook queda activo sin pasos manuales) y `.husky/pre-commit` con `npm run typecheck` (~3,7 s medido). Se prefirió a los hooks nativos (`core.hooksPath`) porque Husky no falla donde no hay `.git` (CI, Workers Builds) y anda igual en Windows. El hook se saltea con `--no-verify`: la garantía real es CI, un workflow de GitHub Actions con `npm ci` + `npm run typecheck` en cada PR (hoy no hay `.github/workflows`).
- **Etapa 2:** Upstash, `secondaryStorage` y limitador por cuenta (ver "Plan por etapas").

**Los hacen los desarrolladores:**

- Login en las previews: cargar `OAUTH_PROXY_SECRET` en producción y en el *base config* de las previews (el mismo valor), y en las previews `GOOGLE_CLIENT_SECRET` y un `BETTER_AUTH_SECRET` propio.
- **Cerrar las previews con Cloudflare Access, con ingreso por GitHub** (decidido, sin hacer). Las previews son públicas y escriben en `dev`; con el proxy y Google en "Production", cualquiera con la URL y una cuenta de Google puede iniciar sesión y crear su usuario en `dev`. Pasos (documentación de Cloudflare, oct.–nov. 2026):
  1. **Workers & Pages** → `fibonacci` → **Access** → **Protect this Worker behind Access** → **Previews only** (la producción, dominio y `workers.dev`, queda pública). La política de ese diálogo solo ofrece "Cloudflare account" o "Email domain": se reemplaza en el paso 4 (`gmail.com` dejaría entrar a cualquier cuenta de Gmail).
  2. GitHub → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth app**: Homepage `https://<team-name>.cloudflareaccess.com`, callback `https://<team-name>.cloudflareaccess.com/cdn-cgi/access/callback` (team name en **Zero Trust** → **Settings** → **Team name and domain**). No hace falta una organización de GitHub.
  3. **Zero Trust** → **Integrations** → **Identity providers** → **Add new** → **GitHub** (App ID = Client ID, más el secreto) → **Finish setup** → **Test**.
  4. **Zero Trust** → **Access** → **Applications** → la aplicación del paso 1 → **Policies**: una regla *Allow* con **Include → Emails** (la lista del equipo) y **Require → Login Methods → GitHub**. Nunca "Everyone" ni solo "Login Methods" sin emails. **Session Duration** hasta un mes.
  - Sin documentar, probar: qué email manda GitHub (principal o público; probar primero con un solo email) y si se puede saltear la pantalla de elegir método de ingreso. Tampoco se confirmó el límite gratuito de Zero Trust ni que "Previews only" cubra las previews de `wrangler preview`.
  - Después, Claude verifica: la preview pide ingreso, producción sigue pública y el login con Google dentro de la preview sigue funcionando. Sumar un compañero = agregar su email a la regla.
- Neon: crear un rol dedicado `hyperdrive-user` con permisos mínimos (hoy se usa `fibonacci_owner`).
- Decidir el nombre final del repo.
- Cloudflare: conectar el repo a Workers Builds y limpiar las reglas de zona del intento anterior (no se confirmó que estén limpias).
- **Etapa 2:** Upstash: crear el Redis en la cuenta nueva (São Paulo). No hace falta en la etapa 1.
- Construir la sección "Precios" de la landing cuando llegue el momento.

## Convenciones

- Idioma de la interfaz y comentarios: español (Argentina).
- Commits en español, pequeños y descriptivos.
- Antes de agregar una dependencia: ¿es erasable-syntax friendly, mantenida y aburrida?
