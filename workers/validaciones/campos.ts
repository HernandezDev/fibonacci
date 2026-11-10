import type { InferInsertModel, Table } from "drizzle-orm";
import type { z } from "zod";

// Guía para escribir los esquemas de Zod a mano contra una tabla:
//   z.object({ ... } satisfies CamposDe<typeof turno>)
// El editor autocompleta los nombres de las columnas y el typecheck falla si un
// campo no existe o no da el tipo de su columna (por ejemplo, un `string`
// donde la tabla espera `Date`). Los campos son opcionales: cada esquema lleva
// solo lo que el cliente puede mandar, nunca la fila entera.
export type CamposDe<T extends Table> = {
  [K in keyof InferInsertModel<T>]?: z.ZodType<InferInsertModel<T>[K]>;
};
