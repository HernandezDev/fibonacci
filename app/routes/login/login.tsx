import { redirect } from "react-router";
import { css } from "styled-system/css";

import { sesionContext } from "~/lib/sesion";

import type { Route } from "./+types/login";
import { GoogleSignInButton } from "./components/GoogleSignInButton";

export function meta() {
  return [{ title: "Iniciar sesión — Instituto Fibonacci" }];
}

// Con sesión iniciada no hay nada que hacer acá: `/home` elige el panel. La
// sesión la cargó el layout `spa.tsx`.
export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  if (context.get(sesionContext)) throw redirect("/home");
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
