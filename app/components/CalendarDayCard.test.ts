import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DiaDeGrilla } from "~/lib/calendario";

import { CalendarDayCard } from "./CalendarDayCard";

// Estas pruebas renderizan la casilla a texto HTML (sin navegador) y miran el
// resultado. No se comparan nombres de clases de Panda (son códigos que cambian
// solos), sino lo que importa: qué textos aparecen y cuándo.

// Un día de ejemplo (martes 24/11/2026); cada prueba cambia solo lo que necesita.
function unDia(cambios: Partial<DiaDeGrilla> = {}): DiaDeGrilla {
  return {
    fecha: "2026-11-24", // fecha de la casilla
    numero: 24, // número que se ve
    esHoy: false, // no es hoy
    esRelleno: false, // es un día real
    esPrimeroDelMes: false, // no es el día 1
    ...cambios, // lo que la prueba quiera pisar
  };
}

// Renderiza la casilla y devuelve el HTML como texto.
function dibujar(dia: DiaDeGrilla, extra: { nombreMes?: string; className?: string; children?: string } = {}): string {
  return renderToStaticMarkup(
    createElement(
      CalendarDayCard,
      {
        dia, // la casilla
        nombreDia: "mar", // día de la semana abreviado
        fechaLarga: "martes, 24 de noviembre", // texto para lectores de pantalla
        nombreMes: extra.nombreMes, // opcional
        className: extra.className, // opcional
      },
      extra.children ? createElement("p", null, extra.children) : undefined, // contenido del día, si la prueba lo pide
    ),
  );
}

// Saca el valor del atributo class del <li> (la clase de la celda).
function claseDeLaCelda(html: string): string {
  return html.match(/^<li class="([^"]*)"/)?.[1] ?? ""; // texto entre comillas, o vacío si no hay
}

describe("CalendarDayCard", () => {
  it("muestra el número y la fecha exacta en <time>", () => {
    const html = dibujar(unDia()); // casilla común
    expect(html).toContain('datetime="2026-11-24"'); // la fecha de máquina
    expect(html).toContain('<span aria-hidden="true">24</span>'); // el número visible, oculto a los lectores
  });

  it("incluye la fecha completa para lectores de pantalla", () => {
    expect(dibujar(unDia())).toContain(">martes, 24 de noviembre<"); // texto completo
  });

  it("muestra el día de la semana abreviado (se ve solo en celular)", () => {
    expect(dibujar(unDia())).toContain(">mar<"); // "mar"
  });

  describe("nombre del mes", () => {
    it("aparece solo si es el primer día del mes y se pasó el nombre", () => {
      const html = dibujar(unDia({ fecha: "2026-12-01", numero: 1, esPrimeroDelMes: true }), { nombreMes: "diciembre" });
      expect(html).toContain(">diciembre<"); // visible
    });

    it("no aparece si no es el primer día, aunque se pase el nombre", () => {
      expect(dibujar(unDia(), { nombreMes: "diciembre" })).not.toContain(">diciembre<"); // oculto
    });

    it("no aparece si es el primer día pero no se pasó el nombre", () => {
      const html = dibujar(unDia({ numero: 1, esPrimeroDelMes: true })); // sin nombreMes
      expect(html).not.toContain("diciembre"); // nada que mostrar
    });
  });

  it("dibuja el contenido del día después del encabezado", () => {
    const html = dibujar(unDia(), { children: "Clase de Álgebra" }); // con un turno adentro
    expect(html).toContain("<p>Clase de Álgebra</p>"); // está
    expect(html.indexOf("<p>")).toBeGreaterThan(html.indexOf("<time")); // y viene después del número
  });

  it("suma el className de afuera a las clases propias", () => {
    const clase = claseDeLaCelda(dibujar(unDia(), { className: "mi-clase" })); // clases de la celda
    expect(clase).toContain("mi-clase"); // la de afuera
    expect(clase.split(" ").length).toBeGreaterThan(1); // y además las propias
  });

  describe("estados visuales", () => {
    it("normal, hoy y relleno tienen clases distintas", () => {
      const normal = claseDeLaCelda(dibujar(unDia())); // día común
      const hoy = claseDeLaCelda(dibujar(unDia({ esHoy: true }))); // hoy
      const relleno = claseDeLaCelda(dibujar(unDia({ esRelleno: true }))); // relleno
      expect(new Set([normal, hoy, relleno]).size).toBe(3); // tres combinaciones diferentes
    });

    it("si un día es hoy y relleno a la vez, gana el relleno", () => {
      const ambos = claseDeLaCelda(dibujar(unDia({ esHoy: true, esRelleno: true }))); // caso contradictorio
      const relleno = claseDeLaCelda(dibujar(unDia({ esRelleno: true }))); // relleno solo
      expect(ambos).toBe(relleno); // se ve como relleno
    });
  });
});