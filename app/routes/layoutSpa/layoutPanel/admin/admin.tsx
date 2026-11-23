import { Outlet, redirect } from "react-router";

import { sesionContext } from "~/lib/sesion";
import { rolesDe } from "~/shared/permisos";

import type { Route } from "./+types/admin";

// Esta ruta no dibuja nada propio: el menú lo da el Drawer del panel (secciones
// en `routes/layout/panel/secciones.ts`). Acá queda solo lo específico de
// /admin: exigir el rol admin.
//
// La sesión ya la cargó el layout `spa.tsx`: se lee del contexto, sin pedido.
// Es un chequeo de UX; la seguridad real va siempre en el backend.
export function clientLoader({ context, request }: Route.ClientLoaderArgs) {
  const sesion = context.get(sesionContext);
  if (!sesion) throw redirect("/login");
  if (!rolesDe(sesion.user.role).includes("admin")) throw redirect("/home");

  // `/admin` a secas no tiene contenido: se lo manda a la primera sección.
  if (new URL(request.url).pathname === "/admin") {
    throw redirect("/admin/materias");
  }
  return null;
}

export default function Admin() {
  return <Outlet />;
}