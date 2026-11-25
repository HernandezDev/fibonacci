// Cálculo de los días de la grilla de 30 días (C4). Es una función pura: no
// toca React ni la API y recibe "ahora" por parámetro, así se puede probar con
// cualquier fecha. La usa `CalendarMonthContainer` y, a través de él, las
// agendas del alumno y del profesor.

// Un día de la grilla, con lo que necesita la casilla para dibujarse.
export type DiaDeGrilla = {
  fecha: string; // "2026-11-24": año-mes-día en la zona del usuario; sirve de key y para cruzar con los turnos
  numero: number; // número del día dentro del mes (1 a 31)
  esHoy: boolean; // true solo en la casilla de hoy (se resalta)
  esRelleno: boolean; // true en los días de relleno de la primera y la última semana (en gris, sin turnos)
  esPrimeroDelMes: boolean; // true si numero es 1: esa casilla muestra además el nombre del mes
};

// Cantidad de días reales de la grilla: hoy más los 29 siguientes.
export const DIAS_DE_LA_GRILLA = 30;

// Milisegundos de un día. Se usa solo con fechas en UTC, que no tienen cambio de horario.
const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Qué día es "ahora" en la zona del usuario, como texto "AAAA-MM-DD".
function fechaEnZona(ahora: Date, zona: string): string {
  // El idioma en-CA escribe las fechas como AAAA-MM-DD, que es lo que queremos.
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona, // la zona del Perfil: a las 23:00 en Buenos Aires ya es "mañana" en UTC
    year: "numeric", // año con cuatro cifras
    month: "2-digit", // mes con dos cifras
    day: "2-digit", // día con dos cifras
  });
  return formato.format(ahora); // devuelve, por ejemplo, "2026-11-24"
}

// Posición de un día en la semana empezando por el lunes: lunes = 0 ... domingo = 6.
function posicionEnSemana(instanteUtc: number): number {
  const diaJs = new Date(instanteUtc).getUTCDay(); // JavaScript cuenta domingo = 0 ... sábado = 6
  return (diaJs + 6) % 7; // se corre uno para que el lunes sea 0 y el domingo, 6
}

// Todos los casilleros de la grilla, en orden, de lunes a domingo, semana por semana.
export function armarDiasDeGrilla(ahora: Date, zona: string): DiaDeGrilla[] {
  const hoy = fechaEnZona(ahora, zona); // "2026-11-24" en la zona del usuario
  const [anio, mes, dia] = hoy.split("-").map(Number); // se separa en tres números
  const hoyUtc = Date.UTC(anio, mes - 1, dia); // medianoche UTC de ese día (los meses de JavaScript van de 0 a 11)
  const ultimoUtc = hoyUtc + (DIAS_DE_LA_GRILLA - 1) * MS_POR_DIA; // el último día real: hoy + 29

  const diasAntes = posicionEnSemana(hoyUtc); // días de relleno antes de hoy para empezar en lunes
  const diasDespues = 6 - posicionEnSemana(ultimoUtc); // días de relleno después del último para terminar en domingo

  const dias: DiaDeGrilla[] = []; // acá se van juntando las casillas
  // `i` es la distancia en días respecto de hoy: negativa en el relleno inicial, 0 hoy.
  for (let i = -diasAntes; i < DIAS_DE_LA_GRILLA + diasDespues; i++) {
    const fecha = new Date(hoyUtc + i * MS_POR_DIA); // el día número i, en UTC
    dias.push({
      fecha: fecha.toISOString().slice(0, 10), // "2026-11-24T00:00:00.000Z" se recorta a "2026-11-24"
      numero: fecha.getUTCDate(), // día del mes de esa fecha
      esHoy: i === 0, // hoy es la distancia cero
      esRelleno: i < 0 || i >= DIAS_DE_LA_GRILLA, // antes de hoy o después del día 30 es relleno
      esPrimeroDelMes: fecha.getUTCDate() === 1, // el día 1 lleva el nombre del mes
    });
  }
  return dias; // siempre un múltiplo de 7: 5 o 6 semanas completas
}