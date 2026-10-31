---
name: drizzle-orm
description: Build and maintain type-safe Drizzle ORM schemas, queries, relations, migrations, and database connections. Use whenever a TypeScript project imports drizzle-orm, drizzle-kit, drizzle-zod, or Drizzle database drivers.
---

# Drizzle ORM

Use the project's installed Drizzle version and existing dialect/driver patterns. Do not introduce a second relation API, migration workflow, or connection adapter.

## Reference map

`references.md` is the bundled index of official Drizzle documentation. Read only the section needed for details not covered here; use the linked official page or Context7 for current API syntax.

| Need | `references.md` section |
| --- | --- |
| Setup, dialect, provider | Official Entry Points; Getting Started; Connections |
| Tables, columns, constraints, inferred types | Schema & Types |
| `defineRelations`, legacy `relations` | Relations |
| Selects, joins, CRUD, operators, RQB | Querying |
| `drizzle-kit`, generated SQL, migration and team workflow | Migrations |
| Transactions, batching, performance | Advanced |
| Zod, Valibot, ArkType | Validation |
| Seeds and data generators | Seeding |
| Version upgrades | Upgrade |

## First inspect the project

1. Read `package.json` and the lockfile to identify the installed `drizzle-orm` and `drizzle-kit` versions.
2. Locate the existing schema, database factory, `drizzle.config.*`, and migration directory.
3. Identify the SQL dialect and adapter already in use: PostgreSQL, MySQL, SQLite/libsql, D1, Neon, and so on.
4. Check relations before editing them:
   - `defineRelations()` means the current relational-query API.
   - `relations()` means the legacy API; preserve it unless the task explicitly includes a version migration.
5. Use Context7 or the official link from `references.md` for API details that depend on the installed version.

## Schema rules

- Import table and column builders from the matching dialect module: `pg-core`, `mysql-core`, or `sqlite-core`.
- Model database integrity in the schema: `.notNull()`, `.unique()`, `.references()`, primary keys, indexes, and explicit `onDelete` behavior where required.
- Name SQL columns explicitly when application and database naming differ.
- Keep relations separate from foreign keys. A relation declaration enables TypeScript relational queries; `.references()` creates the database constraint.
- Prefer inferred types rather than duplicate interfaces:

```ts
type User = typeof users.$inferSelect;
type NewUser = typeof users.$inferInsert;
```

## Relations and relational queries

For new work on a project using the current API, define all related tables in `defineRelations()` and use `r.one`, `r.many`, and `through` where appropriate. Add aliases when one table references another more than once.

For relational queries, create the Drizzle instance with the project schema so `db.query.*` is available. Keep column selection, relation loading, filters, pagination, and ordering in the query; do not compensate for a missing relation with N+1 queries.

Use the SQL-like query builder for joins, aggregations, set operations, or other queries that are clearer as SQL. Compose optional conditions with the documented operators and `sql` template tag instead of concatenating SQL strings.

## Writes and transactions

- Use `.returning()` only where the chosen dialect supports it; MySQL does not.
- Use `onConflictDoUpdate` or `onConflictDoNothing` only against a primary key or unique constraint.
- Wrap one logical multi-write operation in `db.transaction()`. Nested transactions use savepoints when supported.
- Validate input at the boundary. Use `drizzle-zod`, `drizzle-valibot`, or the project's existing validation layer instead of duplicating model types.

## Migrations

- Development-only prototyping may use `drizzle-kit push` when the project accepts direct schema pushes.
- Production changes use `drizzle-kit generate`, review and commit the generated SQL, then apply with `drizzle-kit migrate` through the project's deployment path.
- Never rewrite, delete, or regenerate already-applied migration files. Add a corrective migration.
- Run `drizzle-kit check` when the project uses generated migrations.

## Dialect caveats

- SQLite needs foreign keys enabled for each connection when the driver does not enable them itself.
- SQLite booleans are typically `integer(..., { mode: "boolean" })`; represent timestamps according to the project's existing convention.
- PostgreSQL and SQLite support `returning()`; MySQL does not.
- Database-specific adapters have different constructor signatures. Copy the existing database factory pattern rather than guessing one.

## Completion checks

- Schema, relations, queries, and migrations agree with the installed version and chosen dialect.
- New foreign keys, indexes, and conflict targets map to real database constraints.
- The focused migration/query test or the relevant project typecheck passes.
- If behavior relies on current Drizzle documentation, cite the exact official page from `references.md` in the final response.
