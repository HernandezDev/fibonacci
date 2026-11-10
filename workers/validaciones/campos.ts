import { zValidator } from "@hono/zod-validator";
import type { InferInsertModel, Table } from "drizzle-orm";
import type { ValidationTargets } from "hono";
import { z } from "zod";
import es from "zod/v4/locales/es.js";

// Mensajes de error de Zod en español. Se importa solo este idioma: `z.locales`
// arrastraría todos.
z.config(es());

// Guía para escribir los esquemas de Zod a mano contra una tabla:
//   z.object({ ... } satisfies CamposDe<typeof turno>)
// El editor autocompleta los nombres de las columnas y el typecheck falla si un
// campo no existe o no da el tipo de su columna (por ejemplo, un `string`
// donde la tabla espera `Date`). Los campos son opcionales: cada esquema lleva
// solo lo que el cliente puede mandar, nunca la fila entera.
export type CamposDe<T extends Table> = {
  [K in keyof InferInsertModel<T>]?: z.ZodType<InferInsertModel<T>[K]>;
};

// Validador de las rutas: igual que `zValidator`, pero si los datos no pasan
// responde 400 con `{ error }` (el primer problema, en español), la misma forma
// que el resto de los errores de la API.
export const validar = <T extends keyof ValidationTargets, S extends z.ZodType>(
  target: T,
  esquema: S,
) =>
  zValidator(target, esquema, (resultado, c) => {
    if (!resultado.success) {
      return c.json({ error: resultado.error.issues[0].message }, 400);
    }
  });
