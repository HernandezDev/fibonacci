import { sql } from "drizzle-orm";
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
import { filtroDisponibles } from "../validaciones/turnos";

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
  );
