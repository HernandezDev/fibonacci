import { createMiddleware } from "hono/factory";

import { type Permisos, puede } from "../app/lib/permisos";
import { createAuth } from "./auth";
import { type Db, withDb } from "./pg-client";

type Usuario = ReturnType<typeof createAuth>["$Infer"]["Session"]["user"];

// Lo que las rutas reciben en `c.var` después de `conSesion`.
export type ConSesion = {
  Bindings: Env;
  Variables: { db: Db; usuario: Usuario };
};

// Toda ruta de la API que no sea pública empieza con esto:
//   .get("/x", conSesion(), ...)                       cualquier usuario con sesión
//   .post("/x", conSesion({ materia: ["crear"] }), ...) además, ese permiso
// Abre UNA conexión para todo el request: con ella se lee la sesión y la usa
// también la ruta (`c.var.db`); se cierra cuando la ruta termina.
// Responde 401 sin sesión y 403 sin el permiso. Que el recurso pertenezca al
// usuario (por ejemplo, que la regla sea de ese profesor) lo verifica la ruta.
export const conSesion = (permisos?: Permisos) =>
  createMiddleware<ConSesion>((c, next) =>
    withDb(c.env, c.executionCtx, async (db) => {
      // ¿Quién es? Better Auth valida la cookie contra la tabla `session`
      // (vencida, revocada o usuario baneado = null).
      const sesion = await createAuth(c.env, db).api.getSession({
        headers: c.req.raw.headers,
      });
      if (!sesion) return c.json({ error: "Iniciá sesión" }, 401);

      // ¿Puede hacer esto? Se evalúa en memoria contra `permisos.ts`, con el
      // evaluador de Better Auth. No se usa `auth.api.userHasPermission`: sin
      // headers falla, porque la `baseURL` dinámica necesita el host del request
      // ("Dynamic baseURL could not be resolved"), y con headers vuelve a leer la
      // sesión de la base.
      if (permisos && !puede(sesion.user.role, permisos)) {
        return c.json({ error: "No tenés permiso" }, 403);
      }

      c.set("db", db);
      c.set("usuario", sesion.user);
      await next();
    }),
  );
