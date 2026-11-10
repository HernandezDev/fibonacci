import { SignOutIcon } from "@phosphor-icons/react/ssr";
import { data, redirect, useNavigate } from "react-router";
import { css } from "styled-system/css";

import { Button, ButtonLink } from "~/components/Button";
import { authClient } from "~/lib/auth-client";
import { puede } from "~/lib/permisos";

import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Inicio — Instituto Fibonacci" }];
}

// Sin sesión, a `/login`. Esto solo decide qué pantalla mostrar: la API
// igual tiene que verificar la sesión en cada ruta.
export async function clientLoader() {
  const res = await authClient.getSession();
  if (res.error) {
    throw data("No se pudo cargar la sesión", { status: res.error.status });
  }
  if (!res.data) throw redirect("/login");
  return res.data;
}

export function HydrateFallback() {
  return <p className={css({ px: "6", py: "16" })}>Cargando…</p>;
}

export default function Home({ loaderData: session }: Route.ComponentProps) {
  const navigate = useNavigate();

  async function signOut() {
    await authClient.signOut();
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
        {/* Solo muestra el enlace: quién puede entrar lo decide la API. */}
        {puede(session.user.role, { materia: ["listar"] }) && (
          <ButtonLink
            to="/materias"
            className={css({ display: "inline-flex", mt: "8", mr: "3" })}
          >
            Materias
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
