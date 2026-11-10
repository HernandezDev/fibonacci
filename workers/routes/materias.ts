import { Hono } from "hono";

import { materia } from "../db";
import { conSesion } from "../sesion";
import { validar } from "../validaciones/campos";
import { crearMateria } from "../validaciones/turnos";

// Catálogo de materias (`/api/materias`), lo administra el admin.
export const materias = new Hono<{ Bindings: Env }>()
  // Catálogo completo (también las inactivas), para administrarlo.
  .get("/", conSesion({ materia: ["listar"] }), async (c) => {
    const filas = await c.var.db
      .select({ id: materia.id, nombre: materia.nombre, activo: materia.activo })
      .from(materia)
      .orderBy(materia.nombre);
    return c.json(filas);
  })
  .post(
    "/",
    conSesion({ materia: ["crear"] }),
    validar("json", crearMateria),
    async (c) => {
      const { nombre } = c.req.valid("json");
      // El `unique` de la base decide si ya existe: sin fila devuelta, chocó.
      const [fila] = await c.var.db
        .insert(materia)
        .values({ nombre })
        .onConflictDoNothing({ target: materia.nombre })
        .returning({ id: materia.id, nombre: materia.nombre });
      if (!fila) {
        return c.json({ error: `Ya existe la materia "${nombre}"` }, 409);
      }
      return c.json(fila, 201);
    },
  );
