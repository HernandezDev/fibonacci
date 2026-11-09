import { redirect } from "react-router";
import { css } from "styled-system/css";

import { authClient } from "~/lib/auth-client";

import { GoogleSignInButton } from "./components/GoogleSignInButton";

export function meta() {
  return [{ title: "Iniciar sesión — Instituto Fibonacci" }];
}

// Con sesión iniciada no hay nada que hacer acá: se va a `/home`. Si falla la
// consulta de la sesión, se muestra el login igual.
export async function clientLoader() {
  const { data: session } = await authClient.getSession();
  if (session) throw redirect("/home");
  return null;
}

export function HydrateFallback() {
  return <p className={css({ px: "6", py: "16" })}>Cargando…</p>;
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
