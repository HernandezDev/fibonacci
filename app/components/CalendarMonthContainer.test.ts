import { createElement } from "react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DiaDeGrilla } from "~/lib/calendario";
import { useLocale } from "~/lib/locale";

import { CalendarMonthContainer } from "./CalendarMonthContainer";

// useLocale() lee un contexto que arma el layout `spa`; en estas pruebas no hay
// layout, así que se reemplaza por una función falsa y cada prueba decide qué
// idioma y zona devuelve. (vi.mock se ejecuta antes que los imports.)
vi.mock("~/lib/locale", () => ({ useLocale: vi.fn() }));

const BUENOS_AIRES = "America/Argentina/Buenos_Aires"; // zona de referencia
const TOKIO = "Asia/Tokyo"; // un día adelantada respecto de Buenos Aires a esta hora

// Decide qué devuelve useLocale() en la prueba.
function fijarLocale(zona: string, locale = "es-AR") {
  vi.mocked(useLocale).mockReturnValue({ locale, zona } as ReturnType<typeof useLocale>); // solo las dos propiedades que usa el contenedor
}

// Renderiza el contenedor a texto HTML.
function dibujar(props: Parameters<typeof CalendarMonthContainer>[0] = {}): string {
  return renderToStaticMarkup(createElement(CalendarMonthContainer, props)); // sin navegador
}

// Cuenta cuántas veces aparece algo en el texto.
function contar(texto: string, patron: RegExp): number {
  return (texto.match(patron) ?? []).length; // el patrón debe llevar la marca "g"
}

// Los nombres de la fila de encabezado (el <div aria-hidden> con un <span> por día).
function encabezados(html: string): string[] {
  const bloque = html.match(/<div aria-hidden="true"[^>]*>(.*?)<\/div>/)?.[1] ?? ""; // contenido del encabezado
  return [...bloque.matchAll(/<span>([^<]+)<\/span>/g)].map((coincidencia) => coincidencia[1]); // texto de cada <span>
}

describe("CalendarMonthContainer", () => {
  beforeEach(() => {
    vi.useFakeTimers(); // congela el reloj para que "hoy" no dependa del día en que se corran las pruebas
    vi.setSystemTime(new Date("2026-11-24T15:00:00Z")); // martes 24/11/2026, 12:00 en Buenos Aires
    fijarLocale(BUENOS_AIRES); // idioma es-AR y zona de Buenos Aires
  });

  afterEach(() => {
    vi.useRealTimers(); // devuelve el reloj real
  });

  describe("estructura", () => {
    it("dibuja una casilla por día: 35 en la grilla de hoy", () => {
      expect(contar(dibujar(), /<li[ >]/g)).toBe(35); // cinco semanas
    });

    it("el encabezado trae los días de lunes a domingo en el idioma del usuario", () => {
      expect(encabezados(dibujar())).toEqual(["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]); // es-AR
    });

    it("sigue el idioma del usuario (en-US)", () => {
      fijarLocale(BUENOS_AIRES, "en-US"); // cambia solo el idioma
      expect(encabezados(dibujar())).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]); // inglés
    });

    it("la lista tiene un nombre para lectores de pantalla, que se puede cambiar", () => {
      expect(dibujar()).toContain('aria-label="Calendario de los próximos 30 días"'); // el de por defecto
      expect(dibujar({ etiqueta: "Mis clases" })).toContain('aria-label="Mis clases"'); // uno propio
    });

    it("aplica el className de afuera al contenedor", () => {
      expect(dibujar({ className: "mi-clase" }).startsWith('<div class="mi-clase">')).toBe(true); // primera etiqueta
    });
  });

  describe("textos de las casillas", () => {
    it("el nombre del mes aparece una sola vez: el 1 de diciembre", () => {
      expect(contar(dibujar(), />diciembre</g)).toBe(1); // en el rótulo visible, no en las fechas largas
    });

    it("cada casilla trae su fecha completa para lectores de pantalla", () => {
      expect(dibujar()).toContain(">martes, 24 de noviembre<"); // la de hoy
    });
  });

  describe("renderDia", () => {
    it("se llama una vez por casilla, en orden", () => {
      const renderDia = vi.fn((_dia: DiaDeGrilla): ReactNode => null); // función espía que no dibuja nada
      dibujar({ renderDia }); // se renderiza
      expect(renderDia).toHaveBeenCalledTimes(35); // una por casilla
      expect(renderDia.mock.calls[0][0].fecha).toBe("2026-11-23"); // primera: el lunes
      expect(renderDia.mock.calls[34][0].fecha).toBe("2026-12-27"); // última: el domingo
    });

    it("su resultado se dibuja dentro del día que corresponde", () => {
      const renderDia = (dia: DiaDeGrilla): ReactNode =>
        dia.fecha === "2026-12-01" ? createElement("p", null, "Clase de prueba") : null; // solo el 1 de diciembre
      const html = dibujar({ renderDia }); // se renderiza
      expect(contar(html, /<p>Clase de prueba<\/p>/g)).toBe(1); // aparece una sola vez
    });

    it("sin renderDia las casillas se dibujan vacías", () => {
      const html = dibujar(); // sin función
      expect(contar(html, /<li[ >]/g)).toBe(35); // están todas
      expect(html).not.toContain("<p"); // sin contenido
    });
  });

  describe("zona horaria", () => {
    // Se mira qué día marca como "hoy" a través de renderDia, que recibe todas las marcas.
    function diaDeHoy(): string | undefined {
      const dias: DiaDeGrilla[] = []; // acá se juntan las casillas que recibe renderDia
      dibujar({ renderDia: (dia) => (dias.push(dia), null) }); // guarda cada una
      return dias.find((dia) => dia.esHoy)?.fecha; // la marcada como hoy
    }

    it("usa la zona del usuario: en Buenos Aires hoy es el 24", () => {
      expect(diaDeHoy()).toBe("2026-11-24");
    });

    it("el mismo instante en Tokio ya es el 25", () => {
      fijarLocale(TOKIO); // cambia la zona
      expect(diaDeHoy()).toBe("2026-11-25");
    });
  });
});