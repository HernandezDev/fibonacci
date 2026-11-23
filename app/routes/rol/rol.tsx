import { ListIcon, SignOutIcon } from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { Outlet, redirect, useNavigate } from "react-router";
import { css } from "styled-system/css";

import { Button } from "~/components/Button";
import { Drawer } from "~/components/Drawer";
import { cerrarSesion, sesionContext } from "~/lib/sesion";
import { esRol, rolesDe, type Rol } from "~/shared/permisos";

import type { Route } from "./+types/rol";
import { SelectorDeRol } from "./components/SelectorDeRol";
import { seccionesPara } from "./secciones";

// Layout de los paneles `/alumno`, `/profesor` y `/admin` (el mismo módulo en
// las tres rutas). El rol activo es el primer tramo de la URL, así que no se
// guarda en ningún lado: cambiar de rol es navegar a otro panel.
// La sesión ya la cargó el middleware de `spa.tsx`. Esto solo decide qué
// mostrar: la API igual verifica la sesión y el rol en cada llamada.
export function clientLoader({ context, request }: Route.ClientLoaderArgs) {
  const sesion = context.get(sesionContext);
  if (!sesion) throw redirect("/login");

  // Un panel de un rol que el usuario no tiene: `/home` elige uno que sí.
  const roles = rolesDe(sesion.user.role);
  const { pathname } = new URL(request.url);
  const rol = pathname.split("/")[1] ?? "";
  if (!esRol(rol) || !roles.includes(rol)) throw redirect("/home");

  // `/<rol>` a secas no tiene contenido: a la primera sección del panel.
  if (pathname.replace(/\/$/, "") === `/${rol}`) {
    throw redirect(seccionesPara(rol)[0].to);
  }
  return { roles, rol };
}

// Por defecto, el loader de un layout no se vuelve a correr al navegar entre
// sus hijas. Acá sí, para que `/<rol>` a secas redirija también desde dentro
// del mismo panel. No hace pedidos: la sesión viene del contexto.
export function shouldRevalidate() {
  return true;
}

export default function PanelDeRol({ loaderData }: Route.ComponentProps) {
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();

  function cambiarRol(rol: Rol) {
    setAbierto(false);
    navigate(`/${rol}`);
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

      <Drawer
        open={abierto}
        onClose={() => setAbierto(false)}
        sections={seccionesPara(loaderData.rol)}
      >
        <SelectorDeRol
          roles={loaderData.roles}
          activo={loaderData.rol}
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
