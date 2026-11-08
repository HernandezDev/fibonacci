import { css } from "styled-system/css";

export function meta() {
  return [{ title: "Inicio — Instituto Fibonacci" }];
}

export default function Home() {
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
        Inicio
      </h1>
    </main>
  );
}
