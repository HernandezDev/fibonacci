import { useMemo } from "react";
import type { ReactNode } from "react";
import { css } from "styled-system/css";

import { CalendarDayCard } from "~/components/CalendarDayCard";
import { armarDiasDeGrilla, type DiaDeGrilla } from "~/lib/calendario";
import { useLocale } from "~/lib/locale";

// Grilla de los próximos 30 días (C4). Arma las casillas con
// `armarDiasDeGrilla` y le pasa a cada `CalendarDayCard` los textos ya
// formateados en el idioma y la zona del usuario. NO consulta la API: quien la
// usa decide qué mostrar en cada día con `renderDia` (por ejemplo, las clases
// del alumno o los turnos del profesor).
//
// En compu son siete columnas, de lunes a domingo. En celular pasa a una lista
// de un día por fila (sin relleno), con el día de la semana en cada casilla.

// Fila con los nombres de los días: solo en compu (en celular cada casilla trae el suyo).
const estiloEncabezados = css({
  display: { base: "none", md: "grid" }, // oculta en celular
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))", // siete columnas iguales, que pueden achicarse
  gap: "2", // misma separación que la grilla
  mb: "2", // aire antes de las casillas
  textAlign: "center", // el nombre centrado sobre su columna
  fontSize: "sm", // tamaño chico
  fontWeight: "semibold", // peso medio
  textTransform: "capitalize", // "Lun"
  color: "heading", // color de títulos
});

// La grilla de casillas.
const estiloGrilla = css({
  display: "grid", // grilla CSS
  gridTemplateColumns: { base: "1fr", md: "repeat(7, minmax(0, 1fr))" }, // una columna en celular, siete en compu
  gap: "2", // separación entre casillas
  listStyle: "none", // sin viñetas de lista
});

// Lo que recibe el contenedor.
type CalendarMonthContainerProps = {
  renderDia?: (dia: DiaDeGrilla) => ReactNode; // qué dibujar adentro de cada día
  etiqueta?: string; // nombre de la lista para lectores de pantalla
  className?: string; // estilos de afuera (márgenes, etc.)
};

export function CalendarMonthContainer({
  renderDia,
  etiqueta = "Calendario de los próximos 30 días",
  className,
}: CalendarMonthContainerProps) {
  // El idioma (por ejemplo "es-AR") y la zona horaria del Perfil, que da el LocaleProvider del layout spa.
  const { locale, zona } = useLocale();

  // Las casillas se calculan una vez por zona, no en cada render. Se recalcula si el usuario cambia la zona en el Perfil.
  const dias = useMemo(() => armarDiasDeGrilla(new Date(), zona), [zona]);

  // Los formateadores de texto se crean una vez por idioma (crearlos es más caro que usarlos).
  const formatos = useMemo(() => {
    // Todos usan UTC: la fecha de cada casilla es un día de calendario, no un instante, y UTC evita que se corra un día.
    const crear = (opciones: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { ...opciones, timeZone: "UTC" });
    return {
      diaCorto: crear({ weekday: "short" }), // "mar"
      mes: crear({ month: "long" }), // "diciembre"
      fechaLarga: crear({ weekday: "long", day: "numeric", month: "long" }), // "martes, 24 de noviembre"
    };
  }, [locale]);

  // Convierte "2026-11-24" en una fecha para poder formatearla (medianoche UTC, igual que en calendario.ts).
  const aFecha = (fecha: string) => new Date(`${fecha}T00:00:00Z`);

  // Los nombres del encabezado salen de las primeras siete casillas, que siempre son lunes a domingo; así respetan el idioma.
  const encabezados = dias.slice(0, 7).map((dia) => formatos.diaCorto.format(aFecha(dia.fecha)));

  return (
    <div className={className}>
      {/* Encabezado visual: se oculta a los lectores de pantalla porque cada casilla ya dice su fecha completa. */}
      <div aria-hidden="true" className={estiloEncabezados}>
        {encabezados.map((nombre) => (
          <span key={nombre}>{nombre}</span>
        ))}
      </div>
      {/* Lista ordenada: es lo que mejor representa "un día tras otro" y se adapta bien a la vista de celular. */}
      <ol aria-label={etiqueta} className={estiloGrilla}>
        {dias.map((dia) => {
          // La fecha de esta casilla, lista para formatear.
          const fecha = aFecha(dia.fecha);
          return (
            <CalendarDayCard
              key={dia.fecha} // la fecha es única en la grilla
              dia={dia} // todas las marcas de la casilla
              nombreDia={formatos.diaCorto.format(fecha)} // "mar"
              fechaLarga={formatos.fechaLarga.format(fecha)} // "martes, 24 de noviembre"
              nombreMes={dia.esPrimeroDelMes ? formatos.mes.format(fecha) : undefined} // "diciembre" solo el día 1
            >
              {/* Si quien usa la grilla pasó renderDia, se dibuja su contenido; si no, la casilla queda vacía. */}
              {renderDia?.(dia)}
            </CalendarDayCard>
          );
        })}
      </ol>
    </div>
  );
}