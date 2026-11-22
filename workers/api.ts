import { Hono } from "hono";

import { conDatosRegionales, handleAuth } from "./auth";
import { withDb } from "./pg-client";
import { materias } from "./routes/materias";

// Un sub-router por tema en `workers/routes/`, montado acá con `.route()`.
// Todo se encadena: así `AppType` conserva los tipos para Hono RPC.
const app = new Hono<{ Bindings: Env }>()
  .basePath("/api")
  // Better Auth atiende todo `/api/auth/*`. Tiene su propio cliente tipado
  // (`app/lib/auth-client.ts`), no pasa por Hono RPC.
  // `conDatosRegionales` deja el país y la zona horaria de Cloudflare para
  // las cuentas y sesiones nuevas.
  .on(["GET", "POST"], "/auth/*", conDatosRegionales, (c) =>
    withDb(c.env, c.executionCtx, (db) =>
      handleAuth(c.env, db, c.req.raw, {
        pais: c.var.pais,
        zonaHoraria: c.var.zonaHoraria,
      }),
    ),
  )
  .route("/materias", materias)
  .notFound((c) => c.json({ error: "No encontrado" }, 404));

// El frontend lo importa solo con `import type`.
export type AppType = typeof app;
export default app;
