import { redirect } from "react-router";

import { obtenerRolActivo, rutaPrincipal } from "~/lib/rolActivo";
import { sesionContext } from "~/lib/sesion";
import { rolesDe } from "~/shared/permisos";

import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Inicio — Instituto Fibonacci" }];
}

// Sin sesión, a `/login`. La sesión la cargó el layout `spa.tsx`. Esto solo
// decide qué pantalla mostrar: la API igual verifica la sesión en cada ruta.
export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const sesion = context.get(sesionContext);
  if (!sesion) throw redirect("/login");

  const rolActivo = obtenerRolActivo(rolesDe(sesion.user.role));
  if (!rolActivo) throw redirect("/login");
  throw redirect(rutaPrincipal(rolActivo));
}

export default function Home() {
  return null;
}
