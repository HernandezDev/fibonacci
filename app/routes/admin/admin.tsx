import { Link, NavLink, Outlet, redirect } from "react-router";
import { css } from "styled-system/css";

import { rolesDe } from "~/lib/permisos";
import { sesionContext } from "~/lib/sesion";

import type { Route } from "./+types/admin";

// Secciones del panel. Sumar una es agregar una línea acá y su ruta hija en
// `app/routes.ts`.
const secciones = [{ to: "/admin/materias", nombre: "Materias" }];

export function meta() {
  return [{ title: "Panel de administración — Instituto Fibonacci" }];
}

// Chequeo de UX en el cliente: si no hay sesión va a /login, y si no tiene
// rol admin se lo manda a /home. La seguridad real va siempre en el backend.
// `/admin` sin sección muestra solo el menú, sin ninguna pestaña marcada.
// La sesión la cargó el layout `spa.tsx`.
export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const session = context.get(sesionContext);
  if (!session) throw redirect("/login");
  if (!rolesDe(session.user.role).includes("admin")) throw redirect("/home");
  return { user: session.user };
}

export default function Admin({ loaderData }: Route.ComponentProps) {
  return (
    <main className={css({ maxW: "960px", mx: "auto", px: "6", py: "16" })}>
      <Link to="/home" className={css({ textDecoration: "underline" })}>
        ← Inicio
      </Link>
      <h1
        className={css({
          mt: "4",
          fontSize: "3xl",
          fontWeight: "bold",
          color: "heading",
        })}
      >
        Panel de administración
      </h1>
      <p className={css({ mt: "3" })}>
        Sesión iniciada como {loaderData.user.email}.
      </p>

      <nav
        aria-label="Secciones de administración"
        className={css({ mt: "6", display: "flex", gap: "2", flexWrap: "wrap" })}
      >
        {secciones.map((s) => (
          // NavLink marca la sección actual con `aria-current="page"`.
          <NavLink
            key={s.to}
            to={s.to}
            className={css({
              px: "4",
              py: "2",
              rounded: "lg",
              "&:hover:not([aria-current=page])": { bg: "bg.muted" },
              _currentPage: { bg: "primary", color: "primary.text" },
            })}
          >
            {s.nombre}
          </NavLink>
        ))}
      </nav>

      <div className={css({ mt: "8" })}>
        <Outlet />
      </div>
    </main>
  );
}
