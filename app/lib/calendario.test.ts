import { describe, expect, it } from "vitest";

import { armarDiasDeGrilla, DIAS_DE_LA_GRILLA, type DiaDeGrilla } from "./calendario";

// Zonas horarias que usan las pruebas.
const BUENOS_AIRES = "America/Argentina/Buenos_Aires"; // UTC-3, sin horario de verano
const NUEVA_YORK = "America/New_York"; // tiene cambio de horario: detecta días repetidos o salteados
const TOKIO = "Asia/Tokyo"; // adelantada: cuando acá es de noche, allá ya es "mañana"

// Atajo: arma la grilla para un instante escrito como texto ISO (en UTC).
function armar(ahoraIso: string, zona = BUENOS_AIRES): DiaDeGrilla[] {
  return armarDiasDeGrilla(new Date(ahoraIso), zona); // llama a la función real con una fecha fija
}

// Día de la semana de una fecha "AAAA-MM-DD": 0 = domingo, 1 = lunes ... 6 = sábado.
function diaDeLaSemana(fecha: string): number {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay(); // medianoche UTC de esa fecha
}

// Cuántos días hay entre dos fechas "AAAA-MM-DD" (1 si son consecutivas).
function diasEntre(desde: string, hasta: string): number {
  const ms = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`); // diferencia en milisegundos
  return ms / 86_400_000; // se pasa a días
}

// Qué día es en una zona, calculado con OTRO método que el de la función (formato sueco, AAAA-MM-DD),
// para que la prueba no repita el mismo posible error.
function hoyEnZona(ahora: Date, zona: string): string {
  return ahora.toLocaleDateString("sv-SE", { timeZone: zona }); // "2026-11-24"
}

describe("armarDiasDeGrilla", () => {
  describe("un caso conocido: martes 24/11/2026 al mediodía en Buenos Aires", () => {
    const dias = armar("2026-11-24T15:00:00Z"); // 15:00 UTC = 12:00 en Buenos Aires

    it("empieza el lunes anterior y termina el domingo posterior a los 30 días", () => {
      expect(dias).toHaveLength(35); // cinco semanas completas
      expect(dias[0].fecha).toBe("2026-11-23"); // lunes
      expect(dias[34].fecha).toBe("2026-12-27"); // domingo
    });

    it("marca hoy y cuenta 30 días reales", () => {
      const reales = dias.filter((dia) => !dia.esRelleno); // los que no son relleno
      expect(reales).toHaveLength(DIAS_DE_LA_GRILLA); // son 30
      expect(reales[0].fecha).toBe("2026-11-24"); // el primero real es hoy
      expect(reales[0].esHoy).toBe(true); // y está marcado como hoy
      expect(reales[29].fecha).toBe("2026-12-23"); // hoy + 29 días
    });

    it("tiene un día de relleno antes y cuatro después", () => {
      const antes = dias.filter((dia) => dia.esRelleno && dia.fecha < "2026-11-24").map((dia) => dia.fecha); // relleno anterior a hoy
      const despues = dias.filter((dia) => dia.esRelleno && dia.fecha > "2026-11-24").map((dia) => dia.fecha); // relleno posterior
      expect(antes).toEqual(["2026-11-23"]); // solo el lunes
      expect(despues).toEqual(["2026-12-24", "2026-12-25", "2026-12-26", "2026-12-27"]); // jueves a domingo
    });

    it("marca como primer día del mes solo el 1 de diciembre", () => {
      const primeros = dias.filter((dia) => dia.esPrimeroDelMes).map((dia) => dia.fecha); // las casillas con el nombre del mes
      expect(primeros).toEqual(["2026-12-01"]); // una sola
    });
  });

  describe("bordes de la semana", () => {
    it("si hoy es lunes, no hay relleno al principio", () => {
      const dias = armar("2026-11-23T15:00:00Z"); // lunes 23/11/2026
      expect(dias[0].fecha).toBe("2026-11-23"); // la grilla arranca hoy
      expect(dias[0].esHoy).toBe(true); // y es hoy
      expect(dias[0].esRelleno).toBe(false); // sin relleno
    });

    it("si el día 30 cae domingo, no hay relleno al final", () => {
      const dias = armar("2026-11-28T15:00:00Z"); // sábado 28/11/2026: +29 días es domingo 27/12
      const ultimo = dias[dias.length - 1]; // última casilla
      expect(ultimo.fecha).toBe("2026-12-27"); // domingo
      expect(ultimo.esRelleno).toBe(false); // es un día real
      expect(dias).toHaveLength(35); // 5 de relleno inicial (lun a vie) + 30
    });

    it("si hoy es domingo, necesita seis semanas y cruza de año", () => {
      const dias = armar("2026-12-27T15:00:00Z"); // domingo 27/12/2026
      expect(dias).toHaveLength(42); // seis semanas
      expect(dias[0].fecha).toBe("2026-12-21"); // lunes anterior
      expect(dias[41].fecha).toBe("2027-01-31"); // domingo final, ya en 2027
      const primeros = dias.filter((dia) => dia.esPrimeroDelMes).map((dia) => dia.fecha); // casillas con nombre de mes
      expect(primeros).toEqual(["2027-01-01"]); // solo el 1 de enero
    });
  });

  describe("zonas horarias", () => {
    it("a las 23:30 en Buenos Aires sigue siendo el mismo día aunque en UTC ya sea el siguiente", () => {
      const dias = armar("2026-11-25T02:30:00Z"); // 23:30 del 24/11 en Buenos Aires
      expect(dias.find((dia) => dia.esHoy)?.fecha).toBe("2026-11-24"); // hoy es el 24, no el 25
    });

    it("el mismo instante en Tokio ya es el día siguiente", () => {
      const dias = armar("2026-11-25T02:30:00Z", TOKIO); // allá son las 11:30 del 25/11
      expect(dias.find((dia) => dia.esHoy)?.fecha).toBe("2026-11-25"); // hoy es el 25
    });
  });

  describe("fechas especiales", () => {
    it("incluye el 29 de febrero de un año bisiesto", () => {
      const fechas = armar("2028-02-20T15:00:00Z").map((dia) => dia.fecha); // 2028 es bisiesto
      expect(fechas).toContain("2028-02-29"); // existe el 29
      expect(fechas).toContain("2028-03-01"); // y le sigue marzo
    });

    it("no repite ni saltea días cuando cambia el horario (Nueva York, 1/11/2026)", () => {
      const fechas = armar("2026-10-28T12:00:00Z", NUEVA_YORK).map((dia) => dia.fecha); // la grilla cruza el cambio de horario
      expect(fechas).toContain("2026-11-01"); // el día del cambio está
      expect(new Set(fechas).size).toBe(fechas.length); // ninguno repetido
    });
  });

  describe("propiedades que valen para cualquier día del año", () => {
    // Se prueba cada día de 2028 (bisiesto) en tres zonas. Los problemas se juntan en una lista
    // para que, si algo falla, el mensaje diga exactamente en qué día y zona.
    it("la grilla siempre es coherente", () => {
      const errores: string[] = []; // acá se acumulan los problemas encontrados
      const zonas = [BUENOS_AIRES, NUEVA_YORK, TOKIO]; // sin horario de verano, con horario de verano y adelantada
      const inicio = Date.parse("2028-01-01T15:00:00Z"); // primer instante a probar

      for (const zona of zonas) {
        for (let n = 0; n < 366; n++) {
          const ahora = new Date(inicio + n * 86_400_000); // el instante número n
          const dias = armarDiasDeGrilla(ahora, zona); // la grilla de ese momento
          const etiqueta = `${ahora.toISOString()} en ${zona}`; // para identificar el caso si falla
          const reales = dias.filter((dia) => !dia.esRelleno); // los 30 días reales
          const antes = dias.findIndex((dia) => !dia.esRelleno); // cuántas casillas de relleno hay antes

          if (dias.length % 7 !== 0) errores.push(`${etiqueta}: no son semanas completas`); // múltiplo de 7
          if (dias.length !== 35 && dias.length !== 42) errores.push(`${etiqueta}: ${dias.length} casillas`); // 5 o 6 semanas
          if (reales.length !== DIAS_DE_LA_GRILLA) errores.push(`${etiqueta}: ${reales.length} días reales`); // exactamente 30
          if (diaDeLaSemana(dias[0].fecha) !== 1) errores.push(`${etiqueta}: no empieza en lunes`); // primera casilla: lunes
          if (diaDeLaSemana(dias[dias.length - 1].fecha) !== 0) errores.push(`${etiqueta}: no termina en domingo`); // última: domingo
          if (!dias.slice(antes, antes + DIAS_DE_LA_GRILLA).every((dia) => !dia.esRelleno)) {
            errores.push(`${etiqueta}: el relleno no está solo en los extremos`); // los 30 reales son contiguos
          }

          const marcadosHoy = dias.filter((dia) => dia.esHoy); // debería haber exactamente uno
          if (marcadosHoy.length !== 1) errores.push(`${etiqueta}: ${marcadosHoy.length} días marcados como hoy`);
          else if (marcadosHoy[0].fecha !== hoyEnZona(ahora, zona)) errores.push(`${etiqueta}: hoy es ${marcadosHoy[0].fecha}`); // coincide con el método alternativo
          if (marcadosHoy[0]?.esRelleno) errores.push(`${etiqueta}: hoy está marcado como relleno`); // hoy nunca es relleno

          dias.forEach((dia, i) => {
            if (i > 0 && diasEntre(dias[i - 1].fecha, dia.fecha) !== 1) errores.push(`${etiqueta}: salto en ${dia.fecha}`); // consecutivos
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dia.fecha)) errores.push(`${etiqueta}: formato ${dia.fecha}`); // AAAA-MM-DD
            if (dia.numero !== Number(dia.fecha.slice(8, 10))) errores.push(`${etiqueta}: número ${dia.numero} en ${dia.fecha}`); // número = día del mes
            if (dia.esPrimeroDelMes !== (dia.numero === 1)) errores.push(`${etiqueta}: primer día mal marcado en ${dia.fecha}`); // solo el 1
          });
        }
      }

      expect(errores).toEqual([]); // ningún problema en ningún caso
    });
  });

  describe("contrato de la función", () => {
    it("con la misma entrada devuelve siempre lo mismo", () => {
      const ahora = new Date("2026-11-24T15:00:00Z"); // una fecha fija
      expect(armarDiasDeGrilla(ahora, BUENOS_AIRES)).toEqual(armarDiasDeGrilla(ahora, BUENOS_AIRES)); // dos llamadas, mismo resultado
    });

    it("no modifica la fecha que recibe", () => {
      const ahora = new Date("2026-11-24T15:00:00Z"); // una fecha fija
      const antes = ahora.getTime(); // su valor antes de llamar
      armarDiasDeGrilla(ahora, BUENOS_AIRES); // se usa la función
      expect(ahora.getTime()).toBe(antes); // sigue igual
    });

    it("con una zona inexistente lanza un error (la zona se valida antes, en el Perfil)", () => {
      expect(() => armar("2026-11-24T15:00:00Z", "Zona/Inexistente")).toThrow(RangeError); // Intl rechaza la zona
    });
  });
});