import { redirect } from "react-router";
import { css } from "styled-system/css";

import { authClient } from "~/lib/auth-client";
import { rolesDe } from "~/lib/permisos";

import type { Route } from "./+types/admin";

export function meta() {
  return [{ title: "Panel de administración — Instituto Fibonacci" }];
}

// Chequeo de UX en el cliente: si no hay sesión va a /login, y si no tiene
// rol admin se lo manda a /home. La seguridad real va siempre en el backend.
export async function clientLoader() {
  const { data: session } = await authClient.getSession();
  if (!session) throw redirect("/login");
  if (!rolesDe(session.user.role).includes("admin")) throw redirect("/home");
  return { user: session.user };
}

export function HydrateFallback() {
  return <p className={css({ px: "6", py: "16" })}>Cargando…</p>;
}

export default function Admin({ loaderData }: Route.ComponentProps) {
  return (
    <main className={css({ maxW: "960px", mx: "auto", px: "6", py: "16" })}>
      <h1
        className={css({
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
    </main>
  );
}