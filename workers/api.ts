import { sql } from "drizzle-orm";
import { Hono } from "hono";

import { handleAuth } from "./auth";
import { withDb } from "./pg-client";
import { ping } from "./db";

// Las rutas se encadenan: así `AppType` conserva los tipos para Hono RPC.
const app = new Hono<{ Bindings: Env }>()
  .basePath("/api")
  // Better Auth atiende todo `/api/auth/*`. Tiene su propio cliente tipado
  // (`app/lib/auth-client.ts`), no pasa por Hono RPC.
  .on(["GET", "POST"], "/auth/*", (c) =>
    withDb(c.env, c.executionCtx, (db) => handleAuth(c.env, db, c.req.raw)),
  )
  // Ruta de prueba de la base: suma 1 a la única fila de `ping`.
  .get("/health", async (c) => {
    const row = await withDb(c.env, c.executionCtx, async (db) => {
      const [fila] = await db
        .insert(ping)
        .values({ id: 1, n: 1 })
        .onConflictDoUpdate({
          target: ping.id,
          set: { n: sql`${ping.n} + 1`, lastPingAt: sql`now()` },
        })
        .returning();
      return fila;
    });
    return c.json(row);
  })
  .notFound((c) => c.json({ error: "No encontrado" }, 404));

// El frontend lo importa solo con `import type`.
export type AppType = typeof app;
export default app;
