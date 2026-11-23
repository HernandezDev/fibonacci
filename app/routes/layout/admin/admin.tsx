import { Outlet, redirect } from "react-router";
import { css } from "styled-system/css";

import { authClient } from "~/lib/auth-client";
import { rolesDe } from "~/lib/permisos";

import type { Route } from "./+types/admin";

// Esta ruta ya no dibuja nada propio: el menú lo da el Drawer del panel
// (secciones en `routes/panel/secciones.ts`) y el contenedor, el layout
// `routes/panel/panel.tsx`. Acá queda solo lo específico de /admin: exigir
// el rol admin.
//
// Chequeo de UX en el cliente: sin sesión va a /login y sin rol admin, a
// /home. La seguridad real va siempre en el backend.
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { data: session } = await authClient.getSession();
  if (!session) throw redirect("/login");
  if (!rolesDe(session.user.role).includes("admin")) throw redirect("/home");

  // `/admin` a secas no tiene contenido (antes mostraba solo las pestañas):
  // se lo manda a la primera sección.
  if (new URL(request.url).pathname === "/admin") {
    throw redirect("/admin/materias");
  }
  return null;
}

export function HydrateFallback() {
  return <p className={css({ px: "6", py: "16" })}>Cargando…</p>;
}

export default function Admin() {
  return <Outlet />;
}