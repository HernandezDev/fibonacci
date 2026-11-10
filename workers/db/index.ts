// Esquema completo de la base: lo leen drizzle-kit (`drizzle.config.ts`), el
// adaptador de Better Auth y `withDb`. Cada archivo nuevo de tablas se suma acá.

// Tablas de Better Auth (user, session, account, verification, rate_limit).
export * from "./auth-schema";
// Tablas internas de la app (por ahora, la de prueba `ping`).
export * from "./sistema";
