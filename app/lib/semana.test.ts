import { describe, expect, it } from "vitest";

import { armarSemana, DIAS_DE_LA_SEMANA, enZona, type TurnoDeSemana } from "./semana";

// Zonas horarias que usan las pruebas.
const BUENOS_AIRES = "America/Argentina/Buenos_Aires"; // UTC-3, sin horario de verano
const MADRID = "Europe/Madrid"; // UTC+1 en noviembre: un turno de la tarde en Buenos Aires cruza la medianoche
const NUEVA_YORK = "America/New_York"; // cambia de horario el 8/3/2026

// "Ahora" de casi todas las pruebas: viernes 27/11/2026 a las 12:00 en Buenos Aires.
const AHORA = new Date("2026-11-27T15:00:00Z");

// Atajo: un turno con inicio y fin escritos como texto ISO.
function turno(id: string, inicio: string, fin: string): TurnoDeSemana {
  return { id, inicio: new Date(inicio), fin: new Date(fin) };
}

describe("enZona", () => {
  it("da la fecha y el minuto del día en la zona pedida", () => {
    const instante = new Date("2026-11-27T13:30:00Z");
    expect(enZona(instante, BUENOS_AIRES)).toEqual({ fecha: "2026-11-27", minuto: 10 * 60 + 30 });
    expect(enZona(instante, MADRID)).toEqual({ fecha: "2026-11-27", minuto: 14 * 60 + 30 });
  });

  it("la medianoche es el minuto 0, no el 1440", () => {
    expect(enZona(new Date("2026-11-28T03:00:00Z"), BUENOS_AIRES)).toEqual({ fecha: "2026-11-28", minuto: 0 });
  });
});

describe("armarSemana", () => {
  it("arma 7 días desde hoy en la zona del usuario, y solo el primero es hoy", () => {
    const dias = armarSemana([], AHORA, BUENOS_AIRES);
    expect(dias).toHaveLength(DIAS_DE_LA_SEMANA);
    expect(dias.map((d) => d.fecha)).toEqual([
      "2026-11-27",
      "2026-11-28",
      "2026-11-29",
      "2026-11-30",
      "2026-12-01", // cambia de mes
      "2026-12-02",
      "2026-12-03",
    ]);
    expect(dias.map((d) => d.esHoy)).toEqual([true, false, false, false, false, false, false]);
  });

  it("hoy sale de la zona, no de UTC: a las 23:00 en Buenos Aires todavía no es mañana", () => {
    const dias = armarSemana([], new Date("2026-11-28T02:00:00Z"), BUENOS_AIRES); // 23:00 del 27
    expect(dias[0].fecha).toBe("2026-11-27");
  });

  it("ubica un turno en su día y su minuto", () => {
    const dias = armarSemana([turno("a", "2026-11-28T13:00:00Z", "2026-11-28T14:00:00Z")], AHORA, BUENOS_AIRES);
    expect(dias[1].fragmentos).toHaveLength(1);
    expect(dias[1].fragmentos[0]).toMatchObject({
      key: "a-2026-11-28",
      desde: 10 * 60, // 10:00
      hasta: 11 * 60, // 11:00
      continua: false,
      vieneDeAtras: false,
      enCurso: false,
    });
    expect(dias.filter((d) => d.fragmentos.length > 0)).toHaveLength(1); // ningún otro día lo tiene
  });

  it("ordena los fragmentos de cada día por hora aunque lleguen desordenados", () => {
    const dias = armarSemana(
      [
        turno("tarde", "2026-11-28T20:00:00Z", "2026-11-28T21:00:00Z"),
        turno("mañana", "2026-11-28T12:00:00Z", "2026-11-28T13:00:00Z"),
      ],
      AHORA,
      BUENOS_AIRES,
    );
    expect(dias[1].fragmentos.map((f) => f.turno.id)).toEqual(["mañana", "tarde"]);
  });

  it("corta en dos un turno que cruza la medianoche en la zona del usuario", () => {
    // 19:30 a 20:30 en Buenos Aires = 23:30 a 00:30 en Madrid.
    const dias = armarSemana([turno("a", "2026-11-28T22:30:00Z", "2026-11-28T23:30:00Z")], AHORA, MADRID);
    const [primero] = dias[1].fragmentos;
    const [segundo] = dias[2].fragmentos;
    expect(primero).toMatchObject({ desde: 23 * 60 + 30, hasta: 24 * 60, continua: true, vieneDeAtras: false });
    expect(segundo).toMatchObject({ desde: 0, hasta: 30, continua: false, vieneDeAtras: true });
    expect(primero.key).not.toBe(segundo.key); // dos keys distintas para React
  });

  it("un turno que termina justo a las 00:00 no deja un fragmento vacío ni se marca como cortado", () => {
    const dias = armarSemana([turno("a", "2026-11-29T02:00:00Z", "2026-11-29T03:00:00Z")], AHORA, BUENOS_AIRES); // 23:00 a 00:00
    expect(dias[1].fragmentos).toHaveLength(1);
    expect(dias[1].fragmentos[0]).toMatchObject({ desde: 23 * 60, hasta: 24 * 60, continua: false });
    expect(dias[2].fragmentos).toHaveLength(0);
  });

  it("de un turno que sigue después del último día, muestra solo la parte de adentro", () => {
    // 23:30 del 3/12 (último día) a 00:30 del 4/12, en Madrid.
    const dias = armarSemana([turno("a", "2026-12-03T22:30:00Z", "2026-12-03T23:30:00Z")], AHORA, MADRID);
    expect(dias[6].fragmentos).toHaveLength(1);
    expect(dias[6].fragmentos[0].continua).toBe(true);
  });

  it("deja afuera los turnos de días fuera de la ventana", () => {
    const dias = armarSemana(
      [
        turno("ayer", "2026-11-26T13:00:00Z", "2026-11-26T14:00:00Z"),
        turno("en8dias", "2026-12-04T13:00:00Z", "2026-12-04T14:00:00Z"),
      ],
      AHORA,
      BUENOS_AIRES,
    );
    expect(dias.every((d) => d.fragmentos.length === 0)).toBe(true);
  });

  it("marca en curso el turno que contiene a ahora (incluye el inicio, excluye el fin)", () => {
    const dias = armarSemana(
      [
        turno("empieza", "2026-11-27T15:00:00Z", "2026-11-27T16:00:00Z"), // empieza justo ahora
        turno("termino", "2026-11-27T14:00:00Z", "2026-11-27T15:00:00Z"), // termina justo ahora
      ],
      AHORA,
      BUENOS_AIRES,
    );
    const porId = Object.fromEntries(dias[0].fragmentos.map((f) => [f.turno.id, f.enCurso]));
    expect(porId).toEqual({ empieza: true, termino: false });
  });

  it("devuelve los turnos tal cual, con sus campos propios", () => {
    const conDatos = { ...turno("a", "2026-11-28T13:00:00Z", "2026-11-28T14:00:00Z"), titulo: "Álgebra" };
    const dias = armarSemana([conDatos], AHORA, BUENOS_AIRES);
    expect(dias[1].fragmentos[0].turno).toBe(conDatos);
  });

  it("con cambio de horario usa la hora de reloj de ese día", () => {
    // 8/3/2026 en Nueva York: a las 2:00 se adelanta a las 3:00. Un turno de 10:00 a 11:00 sigue en 10:00.
    const dias = armarSemana(
      [turno("a", "2026-03-08T14:00:00Z", "2026-03-08T15:00:00Z")],
      new Date("2026-03-07T17:00:00Z"),
      NUEVA_YORK,
    );
    expect(dias[1].fecha).toBe("2026-03-08");
    expect(dias[1].fragmentos[0]).toMatchObject({ desde: 10 * 60, hasta: 11 * 60 });
  });
});
