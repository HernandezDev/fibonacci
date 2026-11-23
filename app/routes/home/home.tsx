import { SignOutIcon } from "@phosphor-icons/react/ssr";
import { redirect, useNavigate } from "react-router";
import { css } from "styled-system/css";

import { Button } from "~/components/Button";
import { cerrarSesion, sesionContext } from "~/lib/sesion";
import { rolesDe, type Rol } from "~/shared/permisos";

import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Inicio — Instituto Fibonacci" }];
}

// Con varios roles, el panel en el que se entra. Después se cambia desde el
// Drawer.
const PRIORIDAD: Rol[] = ["alumno", "profesor", "admin"];

// Punto de entrada después de iniciar sesión (y a donde manda un 403 de la
// API): redirige al panel del primer rol del usuario. Sin sesión, a `/login`.
// La sesión la cargó el layout `spa.tsx`.
export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const sesion = context.get(sesionContext);
  if (!sesion) throw redirect("/login");

  const roles = rolesDe(sesion.user.role);
  const rol = PRIORIDAD.find((r) => roles.includes(r));
  if (rol) throw redirect(`/${rol}`);
  // Sin ningún rol conocido no hay panel: se muestra un aviso en vez de
  // redirigir (a `/login` volvería acá).
  return null;
}

export default function Home() {
  const navigate = useNavigate();

  async function salir() {
    await cerrarSesion();
    navigate("/login");
  }

  return (
    <main className={css({ maxW: "640px", mx: "auto", px: "6", py: "16" })}>
      <h1 className={css({ fontSize: "3xl", fontWeight: "bold", color: "heading" })}>
        Tu cuenta no tiene un rol asignado
      </h1>
      <p className={css({ mt: "3" })}>
        Escribinos para que te habiliten el acceso.
      </p>
      <Button
        variant="secondary"
        onClick={salir}
        className={css({ display: "inline-flex", gap: "2", mt: "8" })}
      >
        <SignOutIcon size={20} weight="bold" />
        Cerrar sesión
      </Button>
    </main>
  );
}
