import { createContext, data, useRouteLoaderData } from "react-router";

import type { clientLoader } from "~/routes/layoutSpa/spa";

import { authClient } from "./auth-client";

export type Sesion = typeof authClient.$Infer.Session;

// La sesión se guarda en memoria y se reusa durante este tiempo, para no
// pedirla al Worker (y a la base) en cada navegación. Recargar la página la
// vuelve a pedir. Es solo para la interfaz: la API verifica la sesión en cada
// llamada, así que una sesión vieja como mucho muestra una pantalla de más.
const DURACION_MS = 5 * 60 * 1000;

let guardada: { sesion: Promise<Sesion | null>; hasta: number } | undefined;

// La sesión actual (`null` sin sesión). Si hay una guardada y no venció, no
// hace ningún pedido. Dos navegaciones seguidas (por ejemplo, una redirección)
// comparten el mismo pedido.
export function obtenerSesion() {
  if (!guardada || Date.now() >= guardada.hasta) {
    const sesion = authClient.getSession().then((res) => {
      if (res.error) {
        throw data("No se pudo cargar la sesión", { status: res.error.status });
      }
      return res.data;
    });
    guardada = { sesion, hasta: Date.now() + DURACION_MS };
    // Un error no se guarda: la próxima navegación lo vuelve a intentar.
    sesion.catch(() => {
      if (guardada?.sesion === sesion) guardada = undefined;
    });
  }
  return guardada.sesion;
}

// Descarta la sesión guardada: la próxima navegación la vuelve a pedir. Va
// después de todo lo que cambia la sesión o el usuario (guardar el Perfil, un
// 401 o 403 de la API). Iniciar sesión no lo necesita: Google vuelve con una
// carga completa de la página.
export function olvidarSesion() {
  guardada = undefined;
}

// Cerrar sesión siempre con esta función, no con `authClient.signOut()`
// directo: si no, la interfaz seguiría mostrando la sesión hasta que venza.
export async function cerrarSesion() {
  try {
    await authClient.signOut();
  } finally {
    olvidarSesion();
  }
}

// La sesión de la navegación actual (`null` sin sesión). La guarda el
// middleware del layout `spa.tsx` y la leen los `clientLoader` de las rutas
// SPA con `context.get(sesionContext)`, sin volver a pedirla.
export const sesionContext = createContext<Sesion | null>(null);

// Para los componentes: la sesión que cargó el layout `spa.tsx` (`null` sin
// sesión). Solo funciona dentro de las rutas SPA.
export function useSesion() {
  const datos = useRouteLoaderData<typeof clientLoader>("routes/spa/spa");
  if (datos === undefined) {
    throw new Error("useSesion() tiene que usarse dentro de las rutas SPA.");
  }
  return datos.sesion;
}
