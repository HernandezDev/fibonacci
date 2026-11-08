import { css } from "styled-system/css";

export function meta() {
  return [{ title: "Iniciar sesión — Instituto Fibonacci" }];
}

export default function Login() {
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
        Iniciar sesión
      </h1>
    </main>
  );
}
