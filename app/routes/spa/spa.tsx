import { Outlet } from "react-router";
import { css } from "styled-system/css";

import { LocaleProvider } from "~/lib/locale";
import { obtenerSesion, sesionContext } from "~/lib/sesion";

import type { Route } from "./+types/spa";

// Layout sin URL de todas las rutas SPA (todo menos la landing). En cada
// navegación obtiene la sesión (`cargarSesion`; casi siempre sale de memoria, sin
// pedido) y la comparte: los `clientLoader` de las rutas hijas la toman del
// contexto y los componentes, con `useSesion()`.
// La landing queda afuera a propósito: leer la sesión ahí haría que cada visita
// a `/` llame al Worker y a la base.

// La sesión de cada navegación, compartida por todas las rutas que se cargan en
// ella. `obtenerSesion` la reusa de memoria hasta que vence (ver `sesion.ts`).
// Las redirecciones de las rutas solo deciden qué pantalla mostrar: la API
// igual verifica la sesión en cada llamada.
const cargarSesion: Route.ClientMiddlewareFunction = async (
  { context },
  next,
) => {
  context.set(sesionContext, await obtenerSesion());
  await next();
};

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [
  cargarSesion,
];

export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  return { sesion: context.get(sesionContext) };
}

// Por defecto React Router no vuelve a correr el loader de un layout al
// navegar entre sus hijas. Acá sí, para que `useSesion()` y el locale tengan la
// sesión de esta navegación (no hace otro pedido: la lee del contexto).
export function shouldRevalidate() {
  return true;
}

// Primera carga de cualquier ruta SPA: el layout espera la sesión.
export function HydrateFallback() {
  return <p className={css({ px: "6", py: "16" })}>Cargando…</p>;
}

export default function Spa({ loaderData }: Route.ComponentProps) {
  return (
    <LocaleProvider usuario={loaderData.sesion?.user}>
      <Outlet />
    </LocaleProvider>
  );
}
