import { redirect } from "react-router";
import { css } from "styled-system/css";

import { obtenerRolActivo, rutaPrincipal } from "~/lib/rolActivo";
import { rolesDe } from "~/shared/permisos";
import { sesionContext } from "~/lib/sesion";

import type { Route } from "./+types/login";
import { GoogleSignInButton } from "./components/GoogleSignInButton";

export function meta() {
  return [{ title: "Iniciar sesión — Instituto Fibonacci" }];
}

// Con sesión iniciada entra al panel principal del rol activo. El primero usa
// la prioridad alumno → profesor → admin; el cambio se conserva en el navegador.
// La sesión la cargó el layout `spa.tsx`.
export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const session = context.get(sesionContext);
  if (session) {
    const rolActivo = obtenerRolActivo(rolesDe(session.user.role));
    if (rolActivo) throw redirect(rutaPrincipal(rolActivo));
    throw redirect("/home");
  }
  return null;
}

export default function Login() {
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
        Iniciar sesión
      </h1>
      <GoogleSignInButton />
    </main>
  );
}
