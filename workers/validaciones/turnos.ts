import { z } from "zod";

// Las tablas solo se usan como tipos (`satisfies CamposDe<typeof turno>`): con
// `import type` este archivo no arrastra Drizzle ni el esquema en ejecución.
import type {
  materia,
  profesorMateria,
  reglaDisponibilidad,
  turno,
} from "../db";
import type { CamposDe } from "./campos";

// Lo que el cliente puede mandar a la API de turnos. Se usan con `zValidator`
// y el cliente recibe el tipo por Hono RPC (Zod no llega al bundle). Lo que
// sale de la sesión (alumnoId, profesorId propio) o lo pone la base (id,
// estado, createdAt) no se acepta del cliente.

// Hora "HH:MM", sin segundos: así las horas se comparan bien como texto.
const hora = z.iso.time({ precision: -1 });

// Reservar: `terminaEn` sale de la regla del profesor y `alumnoId`, de la
// sesión. La fecha llega como texto ISO con zona y la ruta la recibe como Date.
export const reservarTurno = z.object({
  profesorId: z.uuid(),
  materiaId: z.uuid(),
  iniciaEn: z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
} satisfies CamposDe<typeof turno>);

// Regla semanal del profesor de la sesión. Repite los `check` de la base para
// responder un error claro en vez del de Postgres.
export const crearRegla = z
  .object({
    diaSemana: z.int().min(1).max(7),
    horaInicio: hora,
    horaFin: hora,
  } satisfies CamposDe<typeof reglaDisponibilidad>)
  .refine((r) => r.horaFin > r.horaInicio, {
    message: "La hora de fin tiene que ser posterior a la de inicio",
    path: ["horaFin"],
  });

// Admin: alta de una materia del catálogo.
export const crearMateria = z.object({
  nombre: z.string().trim().min(1).max(100),
} satisfies CamposDe<typeof materia>);

// Admin: habilitar una materia a un profesor (crea la fila o cambia
// `habilitado`).
export const habilitarMateria = z.object({
  profesorId: z.uuid(),
  materiaId: z.uuid(),
  habilitado: z.boolean(),
} satisfies CamposDe<typeof profesorMateria>);

// Profesor: ofrecer o dejar de ofrecer una materia habilitada. El profesor sale
// de la sesión; la materia, del parámetro de la ruta.
export const activarMateria = z.object({
  activo: z.boolean(),
} satisfies CamposDe<typeof profesorMateria>);

// Parámetro `:id` de las rutas.
export const idParam = z.object({ id: z.uuid() });
