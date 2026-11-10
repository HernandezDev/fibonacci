import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  pgTable,
  timestamp,
} from "drizzle-orm/pg-core";

// Tabla de una sola fila que se usó para verificar la conexión de punta a punta
// (el endpoint `/api/health` ya no existe; la tabla se conserva).
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
