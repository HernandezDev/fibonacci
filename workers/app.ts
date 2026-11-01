import { sql } from "drizzle-orm";
import { createRequestHandler } from "react-router";

import { withDb } from "./db/client";
import { ping } from "./db/schema";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

// Ruta de prueba de la base: suma 1 a la única fila de `ping`.
async function health(env: Env, ctx: ExecutionContext) {
  const row = await withDb(env, ctx, async (db) => {
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
  return Response.json(row);
}

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === "/api/health") {
      return health(env, ctx);
    }
    return requestHandler(request);
  },
} satisfies ExportedHandler<Env>;
