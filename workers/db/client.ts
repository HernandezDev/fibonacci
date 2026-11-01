import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

// Un cliente por request: Hyperdrive hace el pooling, no el Worker. Nada de
// pool global, porque las conexiones no se pueden compartir entre requests.
export async function withDb<T>(
  env: Env,
  ctx: Pick<ExecutionContext, "waitUntil">,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  const client = new Client({
    connectionString: env.HYPERDRIVE.connectionString,
  });
  await client.connect();

  try {
    return await fn(drizzle({ client, schema }));
  } finally {
    // Se cierra después de usarlo y sin demorar la respuesta. `end()` se
    // ejecuta al llamarlo, por eso va acá y no antes de la consulta.
    ctx.waitUntil(client.end());
  }
}
