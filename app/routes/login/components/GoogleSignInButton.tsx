import { GoogleLogoIcon } from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { css } from "styled-system/css";

import { Button } from "~/components/Button";
import { authClient } from "~/lib/auth-client";

// Con Google no hay diferencia entre registrarse e iniciar sesión: si la cuenta
// no existe, Better Auth la crea (con el rol `alumno`).
export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    // Si sale bien, el navegador se va a Google y vuelve a `/home`.
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/home",
    });
    if (error) {
      setError("No se pudo iniciar sesión con Google. Probá de nuevo.");
      setPending(false);
    }
  }

  return (
    <div className={css({ mt: "8" })}>
      <Button
        onClick={signIn}
        disabled={pending}
        className={css({ display: "inline-flex", gap: "2" })}
      >
        <GoogleLogoIcon size={20} weight="bold" />
        Continuar con Google
      </Button>
      {error && (
        <p role="alert" className={css({ mt: "4", color: "danger" })}>
          {error}
        </p>
      )}
    </div>
  );
}
