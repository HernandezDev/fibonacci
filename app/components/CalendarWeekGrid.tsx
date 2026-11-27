import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { css, cx, sva } from "styled-system/css";

import { useLocale } from "~/lib/locale";
import { armarSemana, enZona, type Fragmento, MINUTOS_POR_DIA, type TurnoDeSemana } from "~/lib/semana";

// Grilla de los próximos 7 días con las horas en el eje vertical: cada turno es
// un bloque cuyo alto es proporcional a su duración. Pensada para la agenda del
// alumno (y la del profesor): NO consulta la API, recibe los turnos ya con el
// texto que muestra cada bloque.
//
// No reparte el ancho entre bloques que se pisan: la base no deja que un alumno
// (`turno_alumno_sin_solapamiento`) ni un profesor (`turno_profesor_sin_solapamiento`)
// tenga dos turnos no cancelados a la vez.
//
// Toda la grilla está dentro de una sola caja que se desplaza en los dos
// sentidos: el encabezado de días queda fijo arriba (sticky) y la columna de
// horas fija a la izquierda. En celular las siete columnas no entran, así que
// se desplaza de costado.

// Alto de una hora en píxeles: 1 minuto = 1 px, así las cuentas quedan simples.
const ALTO_HORA_PX = 60;
// Horas de contexto que se ven arriba de la hora actual al abrir.
const HORAS_DE_CONTEXTO = 2;
// Por debajo de este alto (en px) el bloque muestra solo el título.
const ALTO_MINIMO_SUBTITULO_PX = 25;

// Columna de horas de 5rem (80 px) y siete días que no bajan de 6rem: en
// celular la grilla mide más que la pantalla y se desplaza de costado.
const columnas = "5rem repeat(7, minmax(6rem, 1fr))";

const estiloCaja = css({
  layerStyle: "superficie.elevada",
  rounded: "xl",
  overflow: "auto", // se desplaza por dentro, no la página
  maxH: "500px", // unas 8 horas visibles
});

const estiloGrilla = css({
  display: "grid",
  gridTemplateColumns: columnas,
  minW: "max-content", // en celular, más ancha que la caja
});

// Fondo de cada columna de días: una línea fina cada hora. Es un gradiente y no
// un elemento por hora.
const estiloColumnaDia = css({
  position: "relative",
  h: `${MINUTOS_POR_DIA}px`, // el día entero: 24 × 60
  borderLeftWidth: "1px",
  borderColor: "border",
  bgImage: `repeating-linear-gradient(to bottom, token(colors.border) 0 1px, transparent 1px ${ALTO_HORA_PX}px)`,
});

const estiloEncabezado = css({
  position: "sticky",
  top: "0",
  zIndex: "2", // encima de los bloques al desplazar
  py: "2",
  bg: "bg",
  borderBottomWidth: "1px",
  borderColor: "border",
  textAlign: "center",
  fontSize: "xs",
  fontWeight: "semibold",
  textTransform: "uppercase",
  letterSpacing: "wider",
  color: "text",
});

const estiloEncabezadoHoy = css({ color: "heading" });

// La esquina de arriba a la izquierda queda fija en los dos sentidos.
const estiloEsquina = css({ left: "0", zIndex: "3" });

const estiloColumnaHoras = css({
  position: "sticky",
  left: "0",
  zIndex: "1",
  h: `${MINUTOS_POR_DIA}px`,
  bg: "white",
});

const estiloEtiquetaHora = css({
  position: "absolute",
  insetInline: "0",
  top: "var(--top)",
  pr: "3",
  pt: "1", // un poco por debajo de su línea
  textAlign: "right",
  fontSize: "2xs",
  fontWeight: "semibold",
  fontVariantNumeric: "tabular-nums",
  color: "text/70",
  userSelect: "none",
});

// Línea de "ahora" en la columna de hoy.
const estiloAhora = css({
  position: "absolute",
  insetInline: "0",
  top: "var(--top)",
  h: "2px",
  bg: "danger",
  zIndex: "1",
  pointerEvents: "none",
  _before: {
    content: '""',
    position: "absolute",
    left: "-4px",
    top: "-3px",
    w: "8px",
    h: "8px",
    rounded: "full",
    bg: "danger",
  },
});

// Bloque de un turno. `top` y `height` se calculan en runtime y Panda no los
// extrae: entran como variables CSS (`--top`, `--alto`) en `style`.
//
// La barra de color es un elemento aparte y no un `border-left`: donde se
// juntan dos bordes de distinto color el navegador los corta en diagonal. Como
// el bloque tiene `overflow: hidden`, la barra queda recortada con las mismas
// esquinas sin repetirlas.
const estilosBloque = sva({
  slots: ["bloque", "barra", "titulo", "subtitulo"],
  base: {
    bloque: {
      position: "absolute",
      top: "var(--top)",
      h: "var(--alto)",
      insetInline: "0.5", // no toca los bordes de la columna
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      gap: "0.5",
      overflow: "hidden",
      py: "1",
      pl: "2.5", // deja lugar a la barra
      pr: "1.5",
      rounded: "sm",
      borderColor: "secondary/30",
      borderStyle: "dashed",
    },
    barra: { position: "absolute", left: "0", top: "0", bottom: "0", w: "1" },
    titulo: {
      display: "flex",
      alignItems: "flex-start",
      gap: "1",
      fontSize: "xs",
      fontWeight: "semibold",
      lineHeight: "tight",
      color: "heading",
      lineClamp: "2",
    },
    subtitulo: {
      fontSize: "2xs",
      lineHeight: "tight",
      fontVariantNumeric: "tabular-nums",
      color: "text",
      truncate: true,
    },
  },
  variants: {
    estado: {
      confirmado: { bloque: { bg: "secondary/10" }, barra: { bg: "secondary" } },
      enCurso: { bloque: { bg: "primary/15" }, barra: { bg: "primary" } },
    },
    // Un turno cortado en la medianoche se ve como un mismo bloque partido:
    // recto y punteado del lado del corte.
    corte: {
      ninguno: {},
      abajo: { bloque: { roundedBottom: "0", borderBottomWidth: "2px" } },
      arriba: { bloque: { roundedTop: "0", borderTopWidth: "2px" } },
      ambos: { bloque: { rounded: "0", borderTopWidth: "2px", borderBottomWidth: "2px" } },
    },
  },
  defaultVariants: { estado: "confirmado", corte: "ninguno" },
});

// Un turno de la grilla: lo que pide `armarSemana` más lo que muestra el bloque.
export type TurnoDeGrillaSemanal = TurnoDeSemana & {
  titulo: string; // la materia
  subtitulo?: string; // el profesor (para el alumno) o el alumno (para el profesor)
};

type CalendarWeekGridProps = {
  turnos: readonly TurnoDeGrillaSemanal[];
  etiqueta?: string; // nombre de la grilla para lectores de pantalla
  className?: string; // estilos de afuera (márgenes, etc.)
};

// "Ahora", actualizado cada minuto (mueve la línea y el turno en curso) y al
// volver a la pestaña.
function useAhora(): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const actualizar = () => setAhora(new Date());
    const intervalo = setInterval(actualizar, 60_000);
    document.addEventListener("visibilitychange", actualizar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", actualizar);
    };
  }, []);
  return ahora;
}

export function CalendarWeekGrid({
  turnos,
  etiqueta = "Turnos de los próximos 7 días",
  className,
}: CalendarWeekGridProps) {
  const { locale, zona } = useLocale();
  const ahora = useAhora();
  const caja = useRef<HTMLDivElement>(null);

  const dias = useMemo(() => armarSemana(turnos, ahora, zona), [turnos, ahora, zona]);
  const minutoActual = enZona(ahora, zona).minuto;

  // Al abrir y al volver a la pestaña, baja hasta la hora actual con un poco de
  // contexto arriba. No se mueve con cada minuto: el usuario puede haberse
  // desplazado a otra hora.
  useEffect(() => {
    const centrar = () => {
      if (!caja.current || document.visibilityState !== "visible") return;
      const hora = Math.floor(enZona(new Date(), zona).minuto / 60);
      caja.current.scrollTop = Math.max(0, hora - HORAS_DE_CONTEXTO) * ALTO_HORA_PX;
    };
    centrar();
    document.addEventListener("visibilitychange", centrar);
    return () => document.removeEventListener("visibilitychange", centrar);
  }, [zona]);

  const formatos = useMemo(() => {
    // Las fechas de los días y las horas del eje son de calendario, no
    // instantes: se formatean en UTC para que no se corran.
    const crear = (opciones: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { ...opciones, timeZone: "UTC" });
    return {
      diaCorto: crear({ weekday: "short", day: "numeric" }), // "vie 27"
      fechaLarga: crear({ weekday: "long", day: "numeric", month: "long" }), // "viernes, 27 de noviembre"
      horaEje: crear({ hour: "numeric", minute: "2-digit" }), // "10:00" o "10:00 a. m."
    };
  }, [locale]);

  const horasDelEje = useMemo(
    () => Array.from({ length: 24 }, (_, h) => formatos.horaEje.format(Date.UTC(2000, 0, 1, h))),
    [formatos],
  );

  const aFecha = (fecha: string) => new Date(`${fecha}T00:00:00Z`);

  return (
    // `tabIndex` deja desplazar la caja con el teclado.
    <div ref={caja} role="region" aria-label={etiqueta} tabIndex={0} className={cx(estiloCaja, className)}>
      <div className={estiloGrilla}>
        {/* Encabezado: oculto a los lectores, cada columna dice su fecha completa. */}
        <div aria-hidden="true" className={cx(estiloEncabezado, estiloEsquina)} />
        {dias.map((dia) => (
          <div
            key={dia.fecha}
            aria-hidden="true"
            className={cx(estiloEncabezado, dia.esHoy && estiloEncabezadoHoy)}
          >
            {formatos.diaCorto.format(aFecha(dia.fecha))}
          </div>
        ))}

        <div aria-hidden="true" className={estiloColumnaHoras}>
          {horasDelEje.map((hora, h) => (
            <span
              key={hora}
              className={estiloEtiquetaHora}
              style={{ "--top": `${h * ALTO_HORA_PX}px` } as CSSProperties}
            >
              {hora}
            </span>
          ))}
        </div>

        {dias.map((dia) => (
          <section
            key={dia.fecha}
            aria-label={formatos.fechaLarga.format(aFecha(dia.fecha))}
            className={estiloColumnaDia}
          >
            {dia.esHoy && (
              <div
                aria-hidden="true"
                className={estiloAhora}
                style={{ "--top": `${minutoActual}px` } as CSSProperties}
              />
            )}
            {dia.fragmentos.map((fragmento) => (
              <BloqueDeTurno key={fragmento.key} fragmento={fragmento} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function BloqueDeTurno({ fragmento }: { fragmento: Fragmento<TurnoDeGrillaSemanal> }) {
  const { fecha, hora } = useLocale();
  const { turno, desde, hasta, continua, vieneDeAtras, enCurso } = fragmento;
  const alto = ((hasta - desde) * ALTO_HORA_PX) / 60;
  const corte = continua && vieneDeAtras ? "ambos" : continua ? "abajo" : vieneDeAtras ? "arriba" : "ninguno";
  const clases = estilosBloque({ estado: enCurso ? "enCurso" : "confirmado", corte });
  const horario = `${hora.format(turno.inicio)} a ${hora.format(turno.fin)}`;

  return (
    <article
      className={clases.bloque}
      style={{ "--top": `${(desde * ALTO_HORA_PX) / 60}px`, "--alto": `${alto}px` } as CSSProperties}
    >
      <span aria-hidden="true" className={clases.barra} />
      <h3 className={clases.titulo}>
        {vieneDeAtras && <CaretDownIcon aria-hidden="true" className={css({ flexShrink: "0", mt: "0.5" })} />}
        {turno.titulo}
      </h3>
      {alto >= ALTO_MINIMO_SUBTITULO_PX && (
        <p aria-hidden="true" className={clases.subtitulo}>
          {vieneDeAtras ? `Sigue hasta las ${hora.format(turno.fin)}` : horario}
          {turno.subtitulo && ` · ${turno.subtitulo}`}
        </p>
      )}
      {/* Lo que la posición no le dice a un lector de pantalla: cuándo es y con quién. */}
      <p className={css({ srOnly: true })}>
        <time dateTime={turno.inicio.toISOString()}>
          {fecha.format(turno.inicio)}, {horario}
        </time>
        {turno.subtitulo && `, ${turno.subtitulo}`}
        {enCurso && ", en curso"}
        {vieneDeAtras && ", continúa del día anterior"}
      </p>
    </article>
  );
}
