// Carga la oferta académica de prueba: materias, profesores, qué materia da cada
// uno (habilitada y activa) y sus reglas de disponibilidad. No crea alumnos ni
// turnos: esos se crean desde la app.
//
// `npm run db:seed` usa DATABASE_URL (rama dev). `npm run db:seed:prod` usa
// PROD_DATABASE_URL y pide confirmación.
//
// Se puede correr varias veces: materias y profesores se buscan por nombre y
// email, y las reglas de los profesores de acá se borran y se vuelven a crear.
//
// Con `--limpiar` (`db:seed:limpiar` y `db:seed:limpiar:prod`) hace lo
// contrario: borra los profesores de prueba con sus turnos (también son de
// prueba), y las materias de esta lista que hayan quedado sin profesores ni
// turnos. No toca alumnos ni lo que se haya cargado desde el panel.
// Corre con tsx porque `workers/db` importa sin extensión, y Node solo no
// resuelve esos imports.
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, inArray, notExists } from "drizzle-orm";
import { createInterface } from "node:readline/promises";
import { Client } from "pg";

import * as schema from "../workers/db";
import {
  materia,
  profesorMateria,
  reglaDisponibilidad,
  turno,
  user,
} from "../workers/db";

// `.env` es opcional, como en `drizzle.config.ts`.
try {
  process.loadEnvFile();
} catch {}

const MATERIAS = [
  "Matemática (secundaria)",
  "Álgebra",
  "Análisis Matemático I",
  "Análisis Matemático II",
  "Geometría",
  "Probabilidad y Estadística",
];

// Días: 1 = lunes ... 7 = domingo. Horas de Argentina, `HH:MM`. Cada regla es
// un turno reservable, así que dentro de un mismo profesor no se pisan.
type Regla = { dia: number; inicio: string; fin: string };

// Los emails usan `.invalid` (RFC 2606): ese dominio no existe, así que nadie
// puede entrar con Google con el email de un profesor de prueba y quedarse con
// su cuenta. Estos usuarios no pueden iniciar sesión: solo aparecen en la oferta.
const PROFESORES: {
  nombre: string;
  email: string;
  materias: string[];
  reglas: Regla[];
}[] = [
  {
    nombre: "Laura Gómez",
    email: "laura.gomez@profesores.fibonacci.invalid",
    materias: ["Matemática (secundaria)", "Geometría"],
    reglas: [
      ...horas(1, "15:00", 4),
      ...horas(3, "15:00", 4),
      ...horas(5, "10:00", 3),
    ],
  },
  {
    nombre: "Martín Ferreyra",
    email: "martin.ferreyra@profesores.fibonacci.invalid",
    materias: ["Álgebra", "Análisis Matemático I", "Análisis Matemático II"],
    reglas: [
      ...horas(2, "18:00", 3),
      ...horas(4, "18:00", 3),
      ...horas(6, "09:00", 4),
    ],
  },
  {
    nombre: "Sofía Benítez",
    email: "sofia.benitez@profesores.fibonacci.invalid",
    materias: [
      "Probabilidad y Estadística",
      "Análisis Matemático I",
      "Matemática (secundaria)",
    ],
    reglas: [
      ...horas(1, "09:00", 3),
      ...horas(2, "14:00", 4),
      ...horas(4, "14:00", 4),
    ],
  },
];

// `cantidad` turnos de una hora seguidos, desde `desde`.
function horas(dia: number, desde: string, cantidad: number): Regla[] {
  const inicio = Number(desde.slice(0, 2));
  return Array.from({ length: cantidad }, (_, i) => ({
    dia,
    inicio: `${String(inicio + i).padStart(2, "0")}:00`,
    fin: `${String(inicio + i + 1).padStart(2, "0")}:00`,
  }));
}

const prod = process.argv.includes("--prod");
const limpiar = process.argv.includes("--limpiar");
const cadena = prod ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!cadena) {
  console.error(`Falta ${prod ? "PROD_DATABASE_URL" : "DATABASE_URL"}.`);
  process.exit(1);
}
if (!prod && cadena === process.env.PROD_DATABASE_URL) {
  console.error(
    "DATABASE_URL es igual a PROD_DATABASE_URL. Para producción, usar los scripts :prod.",
  );
  process.exit(1);
}

if (prod) {
  if (!process.stdin.isTTY) {
    console.error("No hay terminal interactiva para confirmar. Cancelado.");
    process.exit(1);
  }
  // Solo el host: nunca el usuario ni la contraseña.
  const { hostname } = new URL(cadena);
  const lector = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const respuesta = await lector.question(
    `Estás a punto de ${limpiar ? "borrar" : "cargar"} los datos de prueba en PRODUCCIÓN (${hostname}).\n¿Confirmar? (s/N) `,
  );
  lector.close();
  if (respuesta.trim().toLowerCase() !== "s") {
    console.log("Cancelado. No se tocó la base.");
    process.exit(1);
  }
}

const client = new Client({ connectionString: cadena });
await client.connect();
const db = drizzle({ client, schema });

const emails = PROFESORES.map((p) => p.email);

try {
  if (limpiar) {
    const borrados = await db.transaction(async (tx) => {
      const profesores = await tx
        .select({ id: user.id })
        .from(user)
        .where(inArray(user.email, emails));
      const ids = profesores.map((p) => p.id);

      // `turno` no borra en cascada (protege el historial): van primero. Los de
      // estos profesores son todos de prueba.
      const turnos = ids.length
        ? await tx
            .delete(turno)
            .where(inArray(turno.profesorId, ids))
            .returning({ id: turno.id })
        : [];
      // Borra en cascada sus `profesor_materia` y sus reglas.
      await tx.delete(user).where(inArray(user.email, emails));
      // Solo las de la lista que nadie más usa: si un profesor real da alguna,
      // se queda.
      const materias = await tx
        .delete(materia)
        .where(
          and(
            inArray(materia.nombre, MATERIAS),
            notExists(
              tx
                .select()
                .from(profesorMateria)
                .where(eq(profesorMateria.materiaId, materia.id)),
            ),
            notExists(
              tx.select().from(turno).where(eq(turno.materiaId, materia.id)),
            ),
          ),
        )
        .returning({ id: materia.id });

      return {
        profesores: ids.length,
        turnos: turnos.length,
        materias: materias.length,
      };
    });
    console.log(
      `Borrados: ${borrados.profesores} profesores, ${borrados.turnos} turnos y ${borrados.materias} materias.`,
    );
  } else {
    await cargar();
  }
} finally {
  await client.end();
}

async function cargar() {
  await db.transaction(async (tx) => {
    // Si una materia ya existe (por ejemplo, creada desde el panel), se reusa.
    await tx
      .insert(materia)
      .values(MATERIAS.map((nombre) => ({ nombre })))
      .onConflictDoNothing({ target: materia.nombre });
    const materias = await tx
      .select({ id: materia.id, nombre: materia.nombre })
      .from(materia)
      .where(inArray(materia.nombre, MATERIAS));
    const idMateria = new Map(materias.map((m) => [m.nombre, m.id]));

    await tx
      .insert(user)
      .values(
        PROFESORES.map((p) => ({
          name: p.nombre,
          email: p.email,
          role: "profesor",
        })),
      )
      .onConflictDoNothing({ target: user.email });
    const profesores = await tx
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(inArray(user.email, emails));
    const idProfesor = new Map(profesores.map((p) => [p.email, p.id]));

    for (const p of PROFESORES) {
      const profesorId = idProfesor.get(p.email)!;

      // Habilitada y activa: así cumple `materiaReservable`.
      await tx
        .insert(profesorMateria)
        .values(
          p.materias.map((nombre) => ({
            profesorId,
            materiaId: idMateria.get(nombre)!,
            habilitado: true,
            activo: true,
          })),
        )
        .onConflictDoUpdate({
          target: [profesorMateria.profesorId, profesorMateria.materiaId],
          set: { habilitado: true, activo: true },
        });

      // Los turnos no apuntan a las reglas, así que reemplazarlas no los toca.
      await tx
        .delete(reglaDisponibilidad)
        .where(eq(reglaDisponibilidad.profesorId, profesorId));
      await tx.insert(reglaDisponibilidad).values(
        p.reglas.map((r) => ({
          profesorId,
          diaSemana: r.dia,
          horaInicio: r.inicio,
          horaFin: r.fin,
        })),
      );
    }
  });

  const reglas = PROFESORES.reduce((total, p) => total + p.reglas.length, 0);
  console.log(
    `Listo: ${MATERIAS.length} materias, ${PROFESORES.length} profesores y ${reglas} reglas de disponibilidad.`,
  );
}
