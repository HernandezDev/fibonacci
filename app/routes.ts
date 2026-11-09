import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/landing/landing.tsx"),
  route("home", "routes/home/home.tsx"),
  route("login", "routes/login/login.tsx"),
] satisfies RouteConfig;
