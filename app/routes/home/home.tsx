import { SignOutIcon } from "@phosphor-icons/react/ssr";
import { redirect, useNavigate } from "react-router";
import { css } from "styled-system/css";

import { Button, ButtonLink } from "~/components/Button";
import { rolesDe } from "~/lib/permisos";
import { cerrarSesion, sesionContext } from "~/lib/sesion";

import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Inicio — Instituto Fibonacci" }];
}

// Sin sesión, a `/login`. La sesión la cargó el layout `spa.tsx`. Esto solo
// decide qué pantalla mostrar: la API igual verifica la sesión en cada ruta.
export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const sesion = context.get(sesionContext);
  if (!sesion) throw redirect("/login");
  return sesion;
}

export default function Home({ loaderData: session }: Route.ComponentProps) {
  const navigate = useNavigate();

  async function signOut() {
    await cerrarSesion();
    navigate("/login");
  }

  return (
    <main
      className={css({
        maxW: "960px",
        mx: "auto",
        px: "6",
        py: "16",
      })}
    >
      <h1
        className={css({
          fontSize: "3xl",
          fontWeight: "bold",
          color: "heading",
        })}
      >
        Inicio
      </h1>

      <div className={css({ mt: "8" })}>
        <p>
          Hola, <strong>{session.user.name}</strong> ({session.user.email}).
        </p>
        {/* Varios roles se guardan separados por comas: "admin,profesor". */}
        <p className={css({ mt: "2" })}>
          Roles: {session.user.role?.split(",").join(", ") ?? "sin rol"}
        </p>
        {/* Solo muestra el enlace: quién puede entrar lo decide la API. Misma
            condición que el `clientLoader` de `/admin`. */}
        {rolesDe(session.user.role).includes("admin") && (
          <ButtonLink
            to="/admin"
            className={css({ display: "inline-flex", mt: "8", mr: "3" })}
          >
            Administración
          </ButtonLink>
        )}
        <Button
          variant="secondary"
          onClick={signOut}
          className={css({ display: "inline-flex", gap: "2", mt: "8" })}
        >
          <SignOutIcon size={20} weight="bold" />
          Cerrar sesión
        </Button>
      </div>
    </main>
  );
}
