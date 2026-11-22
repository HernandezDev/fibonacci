import { z } from "zod";

import { esPais, FORMATOS_HORA } from "../../app/lib/regional";
// La tabla solo se usa como tipo (`satisfies CamposDe<typeof user>`).
import type { user } from "../db";
import type { CamposDe } from "./campos";

// Lo que el usuario puede cambiar de su perfil. No pasa por Hono RPC: lo manda
// `authClient.updateUser` y se valida en `databaseHooks.user.update.before`
// (`workers/auth.ts`), así cubre también cualquier otro camino de Better Auth
// que actualice el usuario. Todos los campos son opcionales: se valida solo lo
// que llega.
export const editarPerfil = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Escribí tu nombre")
      .max(100, "El nombre puede tener hasta 100 caracteres"),
    // Sin `.nullable()`: el país se puede cambiar, pero no borrar. Solo queda
    // en `null` si Cloudflare no lo detectó al crear la cuenta.
    pais: z.string().refine(esPais, "País inválido"),
    formatoHora: z.enum(FORMATOS_HORA).nullable(),
  } satisfies CamposDe<typeof user>)
  .partial();
