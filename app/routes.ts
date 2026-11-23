import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/landing/landing.tsx"),
  route("home", "routes/home/home.tsx"),
  route("login", "routes/login/login.tsx"),
  // Layout del panel (Drawer + <Outlet />): comparte la sesión, los roles y el
  // menú con todas las rutas que van adentro.
  layout("routes/layout/panel/panel.tsx", [
route("admin", "routes/layout/admin/admin.tsx", [
  route("materias", "routes/layout/admin/materias/materias.tsx"),
]),
    // Las rutas de alumno y profesor se suman acá cuando existan.
  ]),
] satisfies RouteConfig;