import {
  and,
  asc,
  DrizzleQueryError,
  eq,
  gt,
  isNotNull,
  ne,
  sql,
} from "drizzle-orm";
import { Hono } from "hono";

import {
  materia,
  materiaReservable,
  profesorMateria,
  reglaDisponibilidad,
  turno,
  user,
} from "../db";
import { conSesion } from "../sesion";
import { validar } from "../validaciones/campos";
import { filtroDisponibles, reservarTurno } from "../validaciones/turnos";

type MateriaDisponible = { id: string; nombre: string };

// En `execute`, Drizzle no convierte las columnas: `timestamptz` llega como
// texto. Por eso se piden en ISO 8601 (`to_json`) y se normalizan a UTC.
type FilaDisponible = {
  inicio: string;
  fin: string;
  profesorId: string;
  profesorNombre: string;
  materias: MateriaDisponible[];
};

// Si el error es una exclusion constraint (`23P01`), cuál fue; si no,
// `undefined`. Drizzle envuelve el error de `pg` en `DrizzleQueryError` y lo
// deja en `cause`.
function exclusionViolada(err: unknown) {
  const pg = err instanceof DrizzleQueryError ? err.cause : err;
  if (
    typeof pg === "object" &&
    pg !== null &&
    "code" in pg &&
    pg.code === "23P01" &&
    "constraint" in pg
  ) {
    return pg.constraint;
  }
}

// Mensaje para cada exclusion constraint de `turno` (migraciones 0003 y 0006).
const SOLAPAMIENTO: Record<string, string> = {
  turno_profesor_sin_solapamiento: "Ese turno ya lo reservó otra persona",
  turno_alumno_sin_solapamiento: "Ya tenés otro turno en ese horario",
};

// Turnos (`/api/turnos`).
export const turnos = new Hono<{ Bindings: Env }>()
  // Turnos libres desde ahora hasta dentro de 7 días, ordenados por hora. Cada
  // regla de disponibilidad se repite cada semana: acá se calcula cada día de
  // la ventana en el calendario del profesor y se pasa a un instante con
  // `AT TIME ZONE` y su `zona_horaria`. Un turno queda afuera si:
  // - el profesor no tiene zona, no tiene el rol `profesor` o está baneado;
  // - no tiene ninguna materia reservable (`materiaReservable`), o ninguna que
  //   coincida con `materiaId` si se filtra;
  // - ya empezó, o se pisa con un turno no cancelado de ese profesor (el mismo
  //   rango `[)` que usa la exclusion constraint al reservar);
  // - el profesor es el usuario de la sesión (no puede reservarse a sí mismo).
  .get(
    "/disponibles",
    conSesion({ disponibilidad: ["listar"] }),
    validar("query", filtroDisponibles),
    async (c) => {
      const { materiaId } = c.req.valid("query");
      const yo = c.var.usuario.id;
      const zona = user.zonaHoraria;
      const hoy = sql`(now() at time zone ${zona})::date`;

      const { rows } = await c.var.db.execute<FilaDisponible>(sql`
        select
          to_json(dia.inicio) #>> '{}' as inicio,
          to_json(dia.fin) #>> '{}' as fin,
          ${user.id} as "profesorId",
          ${user.name} as "profesorNombre",
          ofrece.materias
        from ${reglaDisponibilidad}
        join ${user} on ${user.id} = ${reglaDisponibilidad.profesorId}
        -- Los días de la ventana, en el calendario del profesor: 8 días para
        -- cubrir las 7 * 24 horas aunque "ahora" sea a mitad del día.
        cross join lateral (
          select
            (d::date + ${reglaDisponibilidad.horaInicio}) at time zone ${zona} as inicio,
            (d::date + ${reglaDisponibilidad.horaFin}) at time zone ${zona} as fin
          from generate_series(${hoy}, ${hoy} + 7, interval '1 day') as d
          where extract(isodow from d) = ${reglaDisponibilidad.diaSemana}
        ) as dia
        -- Las materias que ese profesor ofrece y se pueden reservar.
        cross join lateral (
          select json_agg(
            json_build_object('id', ${materia.id}, 'nombre', ${materia.nombre})
            order by ${materia.nombre}
          ) as materias
          from ${profesorMateria}
          join ${materia} on ${materia.id} = ${profesorMateria.materiaId}
          where ${profesorMateria.profesorId} = ${reglaDisponibilidad.profesorId}
            and ${materiaReservable}
            ${materiaId ? sql`and ${materia.id} = ${materiaId}` : sql``}
        ) as ofrece
        where ${zona} is not null
          and ',' || ${user.role} || ',' like '%,profesor,%'
          and ${user.banned} is not true
          and ${user.id} <> ${yo}
          and ofrece.materias is not null
          and dia.inicio >= now()
          and dia.inicio < now() + interval '7 days'
          and not exists (
            select 1 from ${turno}
            where ${turno.profesorId} = ${reglaDisponibilidad.profesorId}
              and ${turno.estado} <> 'cancelado'
              and tstzrange(${turno.iniciaEn}, ${turno.terminaEn}, '[)')
                && tstzrange(dia.inicio, dia.fin, '[)')
          )
        order by dia.inicio, ${user.name}
      `);

      return c.json(
        rows.map((f) => ({
          inicio: new Date(f.inicio).toISOString(),
          fin: new Date(f.fin).toISOString(),
          profesor: { id: f.profesorId, nombre: f.profesorNombre },
          materias: f.materias,
        })),
      );
    },
  )
  // Agenda del usuario de la sesión como alumno: sus turnos que todavía no
  // terminaron (uno en curso sigue apareciendo), sin los cancelados, ordenados
  // por hora. Misma forma que la respuesta de reservar. La del profesor va a
  // ser `/agenda/profesor`, con su propio permiso.
  .get("/agenda/alumno", conSesion({ agenda: ["alumno"] }), async (c) => {
    const filas = await c.var.db
      .select({
        id: turno.id,
        inicio: turno.iniciaEn,
        fin: turno.terminaEn,
        profesor: { id: user.id, nombre: user.name },
        materia: { id: materia.id, nombre: materia.nombre },
      })
      .from(turno)
      .innerJoin(user, eq(user.id, turno.profesorId))
      .innerJoin(materia, eq(materia.id, turno.materiaId))
      .where(
        and(
          eq(turno.alumnoId, c.var.usuario.id),
          ne(turno.estado, "cancelado"),
          gt(turno.terminaEn, sql`now()`),
        ),
      )
      .orderBy(asc(turno.iniciaEn));
    return c.json(filas);
  })
  // Reservar un turno libre para el usuario de la sesión. `terminaEn` sale de
  // la regla, no del cliente. Los solapamientos los deciden dos exclusion
  // constraints, también si se reserva a la vez: que nadie haya tomado ese
  // horario del profesor (`turno_profesor_sin_solapamiento`) y que el alumno
  // no tenga otro turno que se pise (`turno_alumno_sin_solapamiento`). Responde con la misma forma que `/disponibles`
  // (con una sola materia), para que el cliente muestre qué reservó.
  // Son dos consultas del builder (y no un `insert ... select`, que en Drizzle
  // exige todas las columnas de la tabla, `id` y defaults incluidos): así
  // Drizzle infiere los tipos y convierte las fechas a `Date`.
  .post(
    "/",
    conSesion({ turno: ["reservar"] }),
    validar("json", reservarTurno),
    async (c) => {
      const { profesorId, materiaId, iniciaEn } = c.req.valid("json");
      const db = c.var.db;
      const yo = c.var.usuario.id;
      const zona = user.zonaHoraria;
      const inicio = sql`${iniciaEn.toISOString()}::timestamptz`;
      // El inicio en el calendario del profesor, para compararlo con la regla.
      const local = sql`(${inicio} at time zone ${zona})`;

      // 1. ¿Es uno de los turnos que lista `/disponibles`? Las mismas
      // condiciones, salvo el solapamiento (eso lo decide el insert). Si sí,
      // da el fin (de la regla) y los nombres para la respuesta.
      const [libre] = await db
        .select({
          terminaEn:
            sql`(${local}::date + ${reglaDisponibilidad.horaFin}) at time zone ${zona}`.mapWith(
              turno.terminaEn,
            ),
          profesor: user.name,
          materia: materia.nombre,
        })
        .from(reglaDisponibilidad)
        .innerJoin(user, eq(user.id, reglaDisponibilidad.profesorId))
        .innerJoin(
          profesorMateria,
          eq(profesorMateria.profesorId, reglaDisponibilidad.profesorId),
        )
        .innerJoin(materia, eq(materia.id, profesorMateria.materiaId))
        .where(
          and(
            eq(reglaDisponibilidad.profesorId, profesorId),
            eq(materia.id, materiaId),
            materiaReservable,
            isNotNull(zona),
            sql`',' || ${user.role} || ',' like '%,profesor,%'`,
            sql`${user.banned} is not true`,
            ne(user.id, yo),
            sql`extract(isodow from ${local}) = ${reglaDisponibilidad.diaSemana}`,
            sql`${local}::time = ${reglaDisponibilidad.horaInicio}`,
            sql`${inicio} >= now()`,
            sql`${inicio} < now() + interval '7 days'`,
          ),
        )
        .limit(1);
      if (!libre) {
        return c.json({ error: "Ese turno no está disponible" }, 404);
      }

      // 2. Reservarlo. Si se pisa con otro turno del profesor o del alumno
      // (también si pasó entre las dos consultas), la base lo rechaza.
      let nuevo;
      try {
        [nuevo] = await db
          .insert(turno)
          .values({
            profesorId,
            alumnoId: yo,
            materiaId,
            iniciaEn,
            terminaEn: libre.terminaEn,
          })
          .returning({
            id: turno.id,
            inicio: turno.iniciaEn,
            fin: turno.terminaEn,
          });
      } catch (err) {
        const constraint = exclusionViolada(err);
        if (typeof constraint === "string" && constraint in SOLAPAMIENTO) {
          return c.json({ error: SOLAPAMIENTO[constraint] }, 409);
        }
        throw err;
      }

      const fila = {
        ...nuevo,
        profesor: { id: profesorId, nombre: libre.profesor },
        materia: { id: materiaId, nombre: libre.materia },
      };
      return c.json(fila, 201);
    },
  );
