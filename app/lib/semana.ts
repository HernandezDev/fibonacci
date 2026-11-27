// Cálculo de la grilla semanal (los próximos 7 días con las horas en el eje
// vertical). Es una función pura, como `armarDiasDeGrilla`: no toca React ni la
// API y recibe "ahora" por parámetro, así se puede probar con cualquier fecha.
// La usa `CalendarWeekGrid`.
//
// Los turnos llegan como instantes (`Date`). Qué día y a qué hora caen se
// calcula en la zona del usuario, nunca con `getHours()` o `getDay()`, que
// usan la zona del dispositivo.

// Lo mínimo que necesita la grilla de cada turno.
export type TurnoDeSemana = {
  id: string; // sirve para armar la key de cada fragmento
  inicio: Date; // instante de inicio
  fin: Date; // instante de fin
};

// Un pedazo de turno dentro de un día. Un turno que cruza la medianoche en la
// zona del usuario se corta en dos (o más) fragmentos, uno por día.
export type Fragmento<T extends TurnoDeSemana> = {
  key: string; // id del turno + fecha del día: único en la grilla
  turno: T; // el turno completo, para mostrar sus datos
  desde: number; // minuto del día en que empieza el fragmento (0 a 1439)
  hasta: number; // minuto del día en que termina (1 a 1440)
  continua: boolean; // el turno sigue al día siguiente: borde inferior recto
  vieneDeAtras: boolean; // el turno empezó el día anterior: borde superior recto
  enCurso: boolean; // "ahora" está entre el inicio y el fin del turno
};

// Un día de la grilla, con sus fragmentos ordenados por hora.
export type DiaDeSemana<T extends TurnoDeSemana> = {
  fecha: string; // "2026-11-27": año-mes-día en la zona del usuario
  esHoy: boolean; // solo el primero
  fragmentos: Fragmento<T>[];
};

// Cantidad de días de la grilla: hoy más los 6 siguientes.
export const DIAS_DE_LA_SEMANA = 7;

// Minutos de un día.
export const MINUTOS_POR_DIA = 24 * 60;

// Milisegundos de un día. Se usa solo con fechas en UTC, que no tienen cambio de horario.
const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Formateadores por zona: crearlos es más caro que usarlos, y la grilla los usa
// varias veces por turno.
const formatosPorZona = new Map<string, Intl.DateTimeFormat>();

function formatoDeZona(zona: string): Intl.DateTimeFormat {
  let formato = formatosPorZona.get(zona);
  if (!formato) {
    formato = new Intl.DateTimeFormat("en-CA", {
      timeZone: zona, // la zona del Perfil
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23", // 00 a 23: con h24 la medianoche sería "24"
    });
    formatosPorZona.set(zona, formato);
  }
  return formato;
}

// Qué día y qué minuto del día es un instante en una zona:
// { fecha: "2026-11-27", minuto: 600 } para las 10:00.
export function enZona(instante: Date, zona: string): { fecha: string; minuto: number } {
  const partes: Record<string, string> = {};
  for (const p of formatoDeZona(zona).formatToParts(instante)) partes[p.type] = p.value;
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    minuto: Number(partes.hour) * 60 + Number(partes.minute),
  };
}

// La fecha "AAAA-MM-DD" que está `dias` días después de otra.
function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

// Los 7 días desde hoy, cada uno con los fragmentos de turnos que caen en él.
// Los turnos (o la parte de ellos) fuera de esos días quedan afuera.
export function armarSemana<T extends TurnoDeSemana>(
  turnos: readonly T[],
  ahora: Date,
  zona: string,
): DiaDeSemana<T>[] {
  const hoy = enZona(ahora, zona).fecha;
  const dias: DiaDeSemana<T>[] = Array.from({ length: DIAS_DE_LA_SEMANA }, (_, i) => ({
    fecha: sumarDias(hoy, i),
    esHoy: i === 0,
    fragmentos: [],
  }));
  // Para encontrar el día de un fragmento sin recorrer la lista cada vez.
  const porFecha = new Map(dias.map((dia) => [dia.fecha, dia]));

  for (const turno of turnos) {
    const inicio = enZona(turno.inicio, zona);
    const fin = enZona(turno.fin, zona);
    const enCurso = turno.inicio <= ahora && ahora < turno.fin;

    // Se recorre día por día desde el del inicio hasta el del fin. Un turno
    // que termina justo a las 00:00 no deja un fragmento vacío en el día siguiente.
    for (let fecha = inicio.fecha; fecha <= fin.fecha; fecha = sumarDias(fecha, 1)) {
      const esPrimero = fecha === inicio.fecha;
      const esUltimo = fecha === fin.fecha;
      const desde = esPrimero ? inicio.minuto : 0;
      const hasta = esUltimo ? fin.minuto : MINUTOS_POR_DIA;
      if (hasta <= desde) continue; // termina a las 00:00, o un cambio de horario lo deja sin largo

      const dia = porFecha.get(fecha);
      if (!dia) continue; // fuera de los 7 días
      dia.fragmentos.push({
        key: `${turno.id}-${fecha}`,
        turno,
        desde,
        hasta,
        continua: !esUltimo && !(fin.minuto === 0 && fecha === sumarDias(fin.fecha, -1)),
        vieneDeAtras: !esPrimero,
        enCurso,
      });
    }
  }

  for (const dia of dias) dia.fragmentos.sort((a, b) => a.desde - b.desde);
  return dias;
}
