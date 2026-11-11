import { Link, NavLink, Outlet, redirect } from "react-router";
import { css } from "styled-system/css";

import type { Route } from "./+types/admin";

// Secciones del panel. Sumar una es agregar una línea acá y su ruta hija en
// `app/routes.ts`.
const secciones = [{ to: "/admin/materias", nombre: "Materias" }];

// `/admin` no tiene contenido propio: va a la primera sección. Quién puede
// entrar lo decide la API en el `clientLoader` de cada sección (401 a `/login`,
// 403 a `/home`), este layout no pregunta nada.
export function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { pathname } = new URL(request.url);
  if (pathname.replace(/\/$/, "") === "/admin") {
    throw redirect(secciones[0].to);
  }
  return null;
}

export function HydrateFallback() {
  return <p className={css({ px: "6", py: "16" })}>Cargando…</p>;
}

export default function Admin() {
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
        Administración
      </h1>

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
