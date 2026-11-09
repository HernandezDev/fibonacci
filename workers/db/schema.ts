import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  pgTable,
  timestamp,
} from "drizzle-orm/pg-core";

// Tablas de Better Auth (user, session, account, verification, rate_limit).
export * from "./auth-schema";

// Tabla de una sola fila para verificar la conexión de punta a punta
// (`/api/health`). Si más adelante hacen falta UUID, usar gen_random_uuid().
export const ping = pgTable(
  "ping",
  {
    id: integer("id").primaryKey().default(1),
    n: bigint("n", { mode: "number" }).notNull().default(0),
    lastPingAt: timestamp("last_ping_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("ping_id_check", sql`${t.id} = 1`)],
);
