import { ListIcon } from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { data, Outlet, redirect } from "react-router";
import { css } from "styled-system/css";

import { Button } from "~/components/Button";
import { Drawer } from "~/components/Drawer";
import { authClient } from "~/lib/auth-client";
import { rolesDe } from "~/lib/permisos";

import type { Route } from "./+types/panel";
import { seccionesPara } from "./secciones";

// Corre en el navegador antes de renderizar el layout y las rutas hijas.
// Esto solo decide qué mostrar: la API igual verifica la sesión y el rol.
export async function clientLoader() {
  // 1. Sesión de Better Auth (mismo manejo que `home`).
  const res = await authClient.getSession();
  if (res.error) {
    throw data("No se pudo cargar la sesión", { status: res.error.status });
  }
  if (!res.data) throw redirect("/login");

  // 2. Roles validados contra los roles reales (lib/permisos.ts). Sin ningún
  //    rol conocido no hay panel que mostrar: a `/home`, que está fuera de
  //    este layout, así que no hay bucle.
  const roles = rolesDe(res.data.user.role);
  if (roles.length === 0) throw redirect("/home");

  // 3. Lo que se devuelve llega al componente como `loaderData`.
  return { roles };
}

// Se muestra mientras el clientLoader resuelve (ssr: false).
export function HydrateFallback() {
  return <p className={css({ px: "6", py: "16" })}>Cargando…</p>;
}

export default function Panel({ loaderData }: Route.ComponentProps) {
  const [abierto, setAbierto] = useState(false);
  const secciones = seccionesPara(loaderData.roles);

  return (
    <>
      <header
        className={css({
          display: "flex",
          alignItems: "center",
          px: { base: "3", md: "6" },
          py: "2",
          borderBottom: "1px solid",
          borderColor: "border",
        })}
      >
        <Button
          variant="icon"
          className={css({ display: "inline-flex" })}
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
        >
          <ListIcon size={24} weight="bold" />
        </Button>
      </header>

      <Drawer open={abierto} onClose={() => setAbierto(false)} sections={secciones} />

      {/* Contenedor común de todas las rutas del panel. Acá React Router pinta
          la ruta hija que corresponda a la URL; las hijas no definen <main>. */}
      <main
        className={css({
          maxW: "960px",
          mx: "auto",
          px: { base: "4", md: "6" },
          py: { base: "8", md: "16" },
        })}
      >
        <Outlet />
      </main>
    </>
  );
}