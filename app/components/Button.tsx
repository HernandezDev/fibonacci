import type { ComponentProps } from "react";
import { Link } from "react-router";
import { cva, cx } from "styled-system/css";
import type { RecipeVariantProps } from "styled-system/types";

// La receta no se exporta: se aplica solo a través de los componentes, para que
// cada uso renderice el elemento correcto (<button> para acciones, <Link> para
// navegar).
// No define `display`: cada lugar de uso lo decide con `className` (por
// ejemplo, oculto en móvil y `inline-flex` desde `md`).
// `cx` solo une clases y no resuelve conflictos: la receta no debe definir
// propiedades que quien la usa vaya a cambiar. Si hace falta, sumar una variante.
const button = cva({
  base: {
    alignItems: "center",
    justifyContent: "center",
    px: "6",
    py: "2.5",
    rounded: "lg",
    shadow: "md",
    transitionProperty: "colors",
    transitionDuration: "150ms",
  },
  variants: {
    variant: {
      primary: {
        bg: "primary",
        color: "primary.text",
        _hover: { bg: "primary/90" },
      },
      secondary: {
        bg: "secondary",
        color: "secondary.text",
        _hover: { bg: "secondary/90" },
      },
    },
  },
  defaultVariants: { variant: "primary" },
});

type Variants = RecipeVariantProps<typeof button>;

// `className` se genera donde se usa, con `css({ ... })`, que Panda extrae ahí
// mismo. Nunca se pasa un objeto de estilos a través del componente.
type Extra = Variants & { className?: string };

type ButtonProps = Omit<ComponentProps<"button">, "className"> & Extra;

export function Button({ variant, className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(button({ variant }), className)}
      {...props}
    />
  );
}

// Link acepta `className` como función; acá solo un string.
type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & Extra;

export function ButtonLink({ variant, className, ...props }: ButtonLinkProps) {
  return <Link className={cx(button({ variant }), className)} {...props} />;
}
