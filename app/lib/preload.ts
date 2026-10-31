import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import type { LinkDescriptor } from "react-router";

// Precarga solo el subset latin de Inter (cubre el español). `crossOrigin` es
// obligatorio en fuentes: sin él el navegador la descarga dos veces.
// Solo en producción: en dev Vite sirve la fuente con otra URL que el
// `@font-face` y se descargaría dos veces.
export function preloadFonts(): LinkDescriptor[] {
  if (!import.meta.env.PROD) return [];

  return [
    {
      rel: "preload",
      href: interLatin,
      as: "font",
      type: "font/woff2",
      crossOrigin: "anonymous",
    },
  ];
}
