import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/landing/landing.tsx"),
  // Todo lo demás es SPA y va dentro de este layout (ver `spa.tsx`).
  layout("routes/layoutSpa/spa.tsx", [
    route("home", "routes/layoutSpa/home/home.tsx"),
    route("login", "routes/layoutSpa/login/login.tsx"),
    // Rutas con menú lateral (Drawer): el layout del panel exige sesión y un
    // rol conocido, y arma las secciones según los roles del usuario.
    layout("routes/layoutSpa/layoutPanel/panel.tsx", [
      route("perfil", "routes/layoutSpa/layoutPanel/perfil/perfil.tsx"),
      route("reservar", "routes/layoutSpa/layoutPanel/reservar/reservar.tsx"),
      route("admin", "routes/layoutSpa/layoutPanel/admin/admin.tsx", [
        route("materias", "routes/layoutSpa/layoutPanel/admin/materias/materias.tsx"),
      ]),
      // Las rutas propias de alumno y profesor se suman acá cuando existan.
    ]),
  ]),
] satisfies RouteConfig;