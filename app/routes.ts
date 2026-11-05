import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/landing/landing.tsx"),
  route("turnos", "routes/turnos/turnos.tsx"),
] satisfies RouteConfig;
