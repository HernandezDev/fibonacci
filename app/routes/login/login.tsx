import { css } from "styled-system/css";

import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Turnos — Instituto Fibonacci" }];
}

// Todavía no hay API de turnos: cuando exista, esta lectura llama a `api.turnos.$get`.
export function clientLoader() {
  return { turnos: [] as { id: number; fecha: string }[] };
}

export default function Turnos({ loaderData }: Route.ComponentProps) {
  const { turnos } = loaderData;

  return (
    <main
      className={css({
        maxW: "960px",
        mx: "auto",
        px: "6",
        py: "16",
      })}
    >
      <h1
        className={css({
          fontSize: "3xl",
          fontWeight: "bold",
          color: "heading",
        })}
      >
        Turnos
      </h1>
      {turnos.length === 0 ? (
        <p className={css({ mt: "4" })}>Todavía no hay turnos para mostrar.</p>
      ) : (
        <ul>
          {turnos.map((t) => (
            <li key={t.id}>{t.fecha}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
