import type { ComponentProps, ReactNode } from "react";
import { css, cva, cx } from "styled-system/css";
import { hstack, vstack } from "styled-system/patterns";
import type { RecipeVariantProps } from "styled-system/types";

import { useLocale } from "~/lib/locale";

// Card de un turno (para reservar) o de una clase (ya tomada o pasada).
// Sigue el patrón de `Button`: la receta no se exporta y los estilos de afuera
// entran solo por `className`. La superficie sale de los `layerStyles` y la
// tipografía de los `textStyles` de `panda.config.ts`, así que la receta solo
// elige cuál usar.
const card = cva({
  base: { p: "4", rounded: "lg" },
  variants: {
    tipo: {
      // Turno libre: se puede tocar para reservar.
      turno: {
        layerStyle: "superficie.elevada",
        transitionProperty: "box-shadow",
        transitionDuration: "150ms",
        _hover: { boxShadow: "md" },
      },
      // Clase tomada o pasada: solo informa.
      clase: { layerStyle: "superficie.apagada" },
    },
  },
  defaultVariants: { tipo: "turno" },
});

// Fechas y horas con `useLocale()` (`app/lib/locale.tsx`): idioma español,
// formato de hora según el Perfil, el país o el navegador, y en la zona horaria
// del Perfil (la del navegador si no tiene). Los turnos llegan como instantes
// (`timestamptz`).

type CardProps = Omit<ComponentProps<"article">, "className" | "title"> &
  RecipeVariantProps<typeof card> & {
    className?: string;
    // La materia.
    titulo: string;
    // Profesor (para el alumno) o alumno (para el profesor).
    subtitulo?: string;
    inicia: Date;
    termina: Date;
    // Por ejemplo, el botón Reservar.
    acciones?: ReactNode;
  };

// La receta no define `display`: el `article` lo decide quien lo usa con
// `className`. El orden interno lo resuelven los patterns `vstack` y `hstack`.
export function Card({
  tipo,
  className,
  titulo,
  subtitulo,
  inicia,
  termina,
  acciones,
  ...props
}: CardProps) {
  const { fecha, hora } = useLocale();
  return (
    <article className={cx(card({ tipo }), className)} {...props}>
      <div className={vstack({ gap: "1", alignItems: "stretch" })}>
        <h3 className={css({ textStyle: "titulo", color: "heading" })}>
          {titulo}
        </h3>
        {subtitulo && (
          <p className={css({ textStyle: "detalle" })}>{subtitulo}</p>
        )}
        <p
          className={css({
            textStyle: "detalle",
            fontVariantNumeric: "tabular-nums",
          })}
        >
          <time dateTime={inicia.toISOString()}>
            {fecha.format(inicia)}, {hora.format(inicia)} a{" "}
            {hora.format(termina)}
          </time>
        </p>
        {acciones && (
          <div className={hstack({ gap: "2", mt: "3", justify: "flex-end" })}>
            {acciones}
          </div>
        )}
      </div>
    </article>
  );
}
