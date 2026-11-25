import type { ReactNode } from "react";
import { css, cx, sva } from "styled-system/css";

import type { DiaDeGrilla } from "~/lib/calendario";

// Casilla de un día de la grilla de 30 días (C4). Es "tonta" a propósito: no
// usa hooks ni formatea fechas. Recibe todo ya armado desde
// `CalendarMonthContainer` y solo lo dibuja; lo que va adentro (los turnos del
// día) entra como `children`, así la misma casilla sirve para la agenda del
// alumno y la del profesor.
//
// Mismo patrón que Drawer: receta de slots sin exportar, y el `className` de
// afuera se suma con `cx`. A diferencia de Button, esta receta SÍ define
// `display`: nadie de afuera lo cambia, y en las casillas de relleno hace falta
// ocultarlas en celular (ahí la grilla pasa a ser una lista de días).
const estilos = sva({
  slots: ["celda", "cabecera", "numero", "mes", "diaSemana"], // las partes de la casilla
  base: {
    celda: {
      flexDirection: "column", // el encabezado arriba y los turnos abajo
      gap: "1", // separación chica entre el encabezado y el contenido
      minW: "0", // deja que la casilla se achique dentro de la grilla sin desbordar
      p: "2", // aire interno
      rounded: "md", // esquinas redondeadas
      minH: { base: "auto", md: "24" }, // en compu todas miden lo mismo; en celular, lo que ocupe su contenido
    },
    cabecera: { display: "flex", alignItems: "center", gap: "2" }, // número, mes y día de la semana en una fila
    numero: {
      display: "inline-flex", // permite centrar el número dentro del círculo
      alignItems: "center", // centrado vertical
      justifyContent: "center", // centrado horizontal
      minW: "6", // ancho mínimo del círculo
      h: "6", // alto del círculo
      px: "1", // un poco de aire si el número crece
      rounded: "full", // lo vuelve un círculo
      fontSize: "sm", // tamaño chico
      fontWeight: "semibold", // peso medio
      color: "heading", // color de los títulos (navy)
    },
    mes: { fontSize: "xs", fontWeight: "semibold", textTransform: "capitalize", color: "heading" }, // "Diciembre"
    diaSemana: {
      display: { base: "inline", md: "none" }, // solo en celular: en compu lo dice el encabezado de la grilla
      fontSize: "xs", // tamaño chico
      textTransform: "capitalize", // "Mar"
      color: "text", // texto normal
    },
  },
  variants: {
    estado: {
      normal: { celda: { display: "flex", layerStyle: "superficie.elevada" } }, // día común: superficie blanca con borde
      hoy: {
        celda: { display: "flex", layerStyle: "superficie.elevada", borderColor: "primary" }, // igual, con el borde de la marca
        numero: { bg: "primary", color: "primary.text" }, // el número de hoy va en un círculo azul marino
      },
      relleno: {
        celda: { display: { base: "none", md: "flex" }, layerStyle: "superficie.apagada" }, // gris; se oculta en celular
        numero: { color: "text/60" }, // número atenuado
      },
    },
  },
});

// Lo que recibe la casilla.
type CalendarDayCardProps = {
  dia: DiaDeGrilla; // la casilla: número, si es hoy, si es relleno
  nombreDia: string; // "mar": se ve solo en celular
  fechaLarga: string; // "martes, 24 de noviembre": solo para lectores de pantalla
  nombreMes?: string; // "diciembre": solo en el primer día de cada mes
  className?: string; // estilos de afuera, generados con css() donde se usa
  children?: ReactNode; // el contenido del día (los turnos)
};

export function CalendarDayCard({
  dia,
  nombreDia,
  fechaLarga,
  nombreMes,
  className,
  children,
}: CalendarDayCardProps) {
  // El estado visual sale de las marcas que calculó armarDiasDeGrilla; el relleno gana sobre "hoy".
  const estado = dia.esRelleno ? "relleno" : dia.esHoy ? "hoy" : "normal";
  // Un objeto con la clase CSS de cada parte: { celda: "...", numero: "...", ... }.
  const clases = estilos({ estado });

  return (
    // <li>: cada día es un elemento de la lista ordenada que arma el contenedor.
    <li className={cx(clases.celda, className)}>
      {/* Encabezado: número del día, nombre del mes (si es el 1) y día de la semana (solo celular). */}
      <div className={clases.cabecera}>
        {/* <time> con dateTime le da la fecha exacta a buscadores y lectores de pantalla. */}
        <time dateTime={dia.fecha} className={clases.numero}>
          {/* El número se ve, pero se oculta de los lectores para no leerlo dos veces. */}
          <span aria-hidden="true">{dia.numero}</span>
          {/* La fecha completa solo la lee el lector de pantalla (srOnly la saca de la vista). */}
          <span className={css({ srOnly: true })}>{fechaLarga}</span>
        </time>
        {/* El nombre del mes aparece solo si es el primer día y el contenedor lo pasó. */}
        {dia.esPrimeroDelMes && nombreMes && (
          <span aria-hidden="true" className={clases.mes}>
            {nombreMes}
          </span>
        )}
        {/* Día de la semana abreviado, visible solo en celular. */}
        <span aria-hidden="true" className={clases.diaSemana}>
          {nombreDia}
        </span>
      </div>
      {/* Acá van los turnos del día, lo que decida quien usa la casilla. */}
      {children}
    </li>
  );
}