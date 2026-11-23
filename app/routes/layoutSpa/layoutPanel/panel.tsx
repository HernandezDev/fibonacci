import { ListIcon, SignOutIcon } from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { Outlet, redirect, useNavigate } from "react-router";
import { css } from "styled-system/css";

import { Button } from "~/components/Button";
import { Drawer } from "~/components/Drawer";
import { cerrarSesion, sesionContext } from "~/lib/sesion";
import { obtenerRolActivo, rutaPrincipal } from "~/lib/rolActivo";
import { rolesDe, type Rol } from "~/shared/permisos";

import type { Route } from "./+types/panel";
import { SelectorDeRol } from "./components/SelectorDeRol";
import { seccionesPara } from "./secciones";

// Este layout va DENTRO de `spa.tsx`: la sesión ya la cargó su middleware y
// está en el contexto, así que acá no se vuelve a pedir. Solo decide qué
// mostrar: la API igual verifica la sesión y el rol en cada llamada.
export function clientLoader({ context }: Route.ClientLoaderArgs) {
  // 1. Sin sesión, al login.
  const sesion = context.get(sesionContext);
  if (!sesion) throw redirect("/login");

  // 2. Roles validados contra los roles reales (shared/permisos.ts). Sin
  //    ninguno conocido no hay panel que mostrar: a `/home`, que vuelve a decidir
  //    el destino según la sesión y evita que el panel quede vacío.
  const roles = rolesDe(sesion.user.role);
  if (roles.length === 0) throw redirect("/home");

  // 3. El rol activo puede cambiar desde el Drawer, pero siempre debe pertenecer
  //    a la lista real obtenida de la sesión. Se devuelve al componente como
  //    `loaderData` y sirve solo para mostrar navegación.
  const rolActivo = obtenerRolActivo(roles);
  return { roles, rolActivo };
}

export default function Panel({ loaderData }: Route.ComponentProps) {
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();
  const secciones = seccionesPara(loaderData.rolActivo);

  function cambiarRol(rol: Rol) {
    setAbierto(false);
    navigate(rutaPrincipal(rol));
  }

  async function salir() {
    await cerrarSesion();
    setAbierto(false);
    navigate("/login");
  }

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

      <Drawer open={abierto} onClose={() => setAbierto(false)} sections={secciones}>
        <SelectorDeRol
          roles={loaderData.roles}
          activo={loaderData.rolActivo}
          alCambiar={cambiarRol}
        />
        <div className={css({ px: "1", mt: "4" })}>
          <Button
            variant="secondary"
            onClick={salir}
            className={css({ display: "inline-flex", w: "full", gap: "2", justifyContent: "center" })}
          >
            <SignOutIcon size={20} weight="bold" />
            Cerrar sesión
          </Button>
        </div>
      </Drawer>

      {/* Acá React Router pinta la ruta hija que corresponda a la URL. */}
      <Outlet />
    </>
  );
}