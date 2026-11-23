import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

import type { Rol } from "./shared/permisos";

// El Perfil es el mismo para todos los roles, pero cuelga de cada panel para
// que se vea con su menú. Un módulo usado en varias rutas necesita un `id`
// distinto en cada una.
const perfil = (rol: Rol) =>
  route("perfil", "routes/perfil/perfil.tsx", { id: `perfil-${rol}` });

export default [
  index("routes/landing/landing.tsx"),
  // Todo lo demás es SPA y va dentro de este layout (ver `spa.tsx`).
  layout("routes/spa/spa.tsx", [
    route("home", "routes/home/home.tsx"),
    route("login", "routes/login/login.tsx"),
    // Un panel por rol, todos con el mismo layout (`rol.tsx`, con el Drawer).
    // El rol activo es el primer tramo de la URL. Las secciones de cada uno se
    // suman acá y en `routes/rol/secciones.ts`.
    route("alumno", "routes/rol/rol.tsx", { id: "rol-alumno" }, [
      route("reservar", "routes/alumno/reservar/reservar.tsx"),
      perfil("alumno"),
    ]),
    route("profesor", "routes/rol/rol.tsx", { id: "rol-profesor" }, [
      perfil("profesor"),
    ]),
    route("admin", "routes/rol/rol.tsx", { id: "rol-admin" }, [
      route("materias", "routes/admin/materias/materias.tsx"),
      perfil("admin"),
    ]),
  ]),
] satisfies RouteConfig;
