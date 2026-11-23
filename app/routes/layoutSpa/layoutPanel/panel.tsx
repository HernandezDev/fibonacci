import { ListIcon } from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { Outlet, redirect } from "react-router";
import { css } from "styled-system/css";

import { Button } from "~/components/Button";
import { Drawer } from "~/components/Drawer";
import { sesionContext } from "~/lib/sesion";
import { rolesDe } from "~/shared/permisos";

import type { Route } from "./+types/panel";
import { seccionesPara } from "./secciones";

// Este layout va DENTRO de `spa.tsx`: la sesión ya la cargó su middleware y
// está en el contexto, así que acá no se vuelve a pedir. Solo decide qué
// mostrar: la API igual verifica la sesión y el rol en cada llamada.
export function clientLoader({ context }: Route.ClientLoaderArgs) {
  // 1. Sin sesión, al login.
  const sesion = context.get(sesionContext);
  if (!sesion) throw redirect("/login");

  // 2. Roles validados contra los roles reales (shared/permisos.ts). Sin
  //    ninguno conocido no hay panel que mostrar: a `/home`, que está fuera de
  //    este layout, así que no hay bucle.
  const roles = rolesDe(sesion.user.role);
  if (roles.length === 0) throw redirect("/home");

  // 3. Lo que se devuelve llega al componente como `loaderData`.
  return { roles };
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

      {/* Acá React Router pinta la ruta hija que corresponda a la URL. */}
      <Outlet />
    </>
  );
}