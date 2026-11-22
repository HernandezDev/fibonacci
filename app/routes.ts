import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/landing/landing.tsx"),
  // Todo lo demás es SPA y va dentro de este layout (ver `spa.tsx`).
  layout("routes/spa/spa.tsx", [
    route("home", "routes/home/home.tsx"),
    route("login", "routes/login/login.tsx"),
    route("admin", "routes/admin/admin.tsx", [
      route("materias", "routes/admin/materias/materias.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
