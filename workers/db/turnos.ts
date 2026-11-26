import { and, eq, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const estadoTurno = pgEnum("estado_turno", [
  "confirmado",
  "cancelado",
  "completado",
]);

// Las filas que tienen turnos no se pueden borrar (las FK protegen el
// historial): se desactivan con `activo = false`.
const activo = () => boolean("activo").notNull().default(true);

// Catálogo de materias. `activo = false`: el instituto dejó de ofrecerla.
export const materia = pgTable("materia", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull().unique(),
  activo: activo(),
  createdAt: createdAt(),
});

// Qué materias da cada profesor (muchos a muchos). Que el usuario tenga el rol
// `profesor` lo verifica el servidor: el rol es texto en `user.role`.
// Dos interruptores, de dos personas distintas (los turnos viejos siguen siendo
// válidos con cualquiera apagado):
// - `habilitado`: lo decide el admin. `false` = el profesor ya no puede darla.
// - `activo`: lo decide el profesor. `false` = no la ofrece, aunque podría.
//   Arranca en `false`: el admin la habilita y el profesor la activa cuando
//   quiera empezar a darla.
// Se puede reservar solo si `materia.activo`, `habilitado` y `activo` están en
// `true`. Quién puede cambiar cada columna lo controla el servidor.
export const profesorMateria = pgTable(
  "profesor_materia",
  {
    profesorId: uuid("profesor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    materiaId: uuid("materia_id")
      .notNull()
      .references(() => materia.id, { onDelete: "restrict" }),
    habilitado: boolean("habilitado").notNull().default(true),
    activo: boolean("activo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.profesorId, t.materiaId] })],
);

// Condición de "se puede reservar", escrita una sola vez: la usan tanto la
// lista de materias como la reserva, en una consulta que une `profesor_materia`
// con `materia`. Es parte del mismo WHERE, no una consulta aparte.
export const materiaReservable = and(
  eq(materia.activo, true),
  eq(profesorMateria.habilitado, true),
  eq(profesorMateria.activo, true),
);

// Horario semanal del profesor: cada regla es un turno reservable que se repite
// todas las semanas (1 = lunes ... 7 = domingo, como `isodow` de Postgres).
// Las horas son de la zona horaria de su profesor (`user.zona_horaria`); al
// calcular turnos se convierten con `AT TIME ZONE` usando esa columna. Un
// profesor sin zona no ofrece turnos.
export const reglaDisponibilidad = pgTable(
  "regla_disponibilidad",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profesorId: uuid("profesor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    diaSemana: smallint("dia_semana").notNull(),
    horaInicio: time("hora_inicio").notNull(),
    horaFin: time("hora_fin").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("regla_disponibilidad_profesor_idx").on(t.profesorId),
    check("dia_semana_valido", sql`${t.diaSemana} between 1 and 7`),
    check("rango_horario_valido", sql`${t.horaFin} > ${t.horaInicio}`),
  ],
);

// Turnos reservados. Que coincidan con una regla del profesor lo verifica el
// servidor al reservar. La doble reserva la frena la base, con dos exclusion
// constraints (migraciones propias, Drizzle no tiene `exclude()`): dos turnos
// no cancelados que se pisen no pueden ser del mismo profesor
// (`turno_profesor_sin_solapamiento`, 0003) ni del mismo alumno
// (`turno_alumno_sin_solapamiento`, 0006).
export const turno = pgTable(
  "turno",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // `profesor_id` y `materia_id` no llevan FK propia: la compuesta de abajo
    // ya garantiza que existen y frena borrar un profesor o una materia con
    // turnos. Las columnas sí hacen falta (las usan la compuesta y la
    // exclusion constraint).
    profesorId: uuid("profesor_id").notNull(),
    alumnoId: uuid("alumno_id")
      .notNull()
      .references(() => user.id),
    materiaId: uuid("materia_id").notNull(),
    iniciaEn: timestamp("inicia_en", { withTimezone: true }).notNull(),
    terminaEn: timestamp("termina_en", { withTimezone: true }).notNull(),
    estado: estadoTurno("estado").notNull().default("confirmado"),
    createdAt: createdAt(),
  },
  (t) => [
    index("turno_alumno_idx").on(t.alumnoId),
    // Solo se puede reservar una materia que ese profesor da. Nombre explícito:
    // el generado pasa los 63 caracteres de Postgres.
    foreignKey({
      name: "turno_profesor_materia_fk",
      columns: [t.profesorId, t.materiaId],
      foreignColumns: [profesorMateria.profesorId, profesorMateria.materiaId],
    }),
    check("rango_turno_valido", sql`${t.terminaEn} > ${t.iniciaEn}`),
    check("alumno_no_es_profesor", sql`${t.alumnoId} <> ${t.profesorId}`),
  ],
);
