import { cva } from "styled-system/css";

// Receta de estilos, no un componente: se aplica al elemento que corresponda
// (<Link> para navegar, <button> para acciones).
// No define `display`: cada lugar de uso lo decide (por ejemplo, oculto en
// móvil y `inline-flex` desde `md`).
export const button = cva({
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
