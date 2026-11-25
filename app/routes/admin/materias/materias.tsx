import { useEffect, useRef } from "react";
import { data, Form, useNavigation } from "react-router";
import { css } from "styled-system/css";

import { Button } from "~/components/Button";
import { CalendarMonthContainer } from "~/components/CalendarMonthContainer";
import { api, controlarAcceso, mensajeDeError } from "~/lib/api";

import type { Route } from "./+types/materias";

export function meta() {
  return [{ title: "Materias — Instituto Fibonacci" }];
}

// La API decide quién puede ver esto (permiso `materia: listar`): sin sesión
// responde 401 y sin permiso, 403. Acá solo se elige a qué pantalla ir.
export async function clientLoader() {
  const res = await api.materias.$get();
  controlarAcceso(res);
  if (!res.ok) {
    throw data("No se pudieron cargar las materias", { status: res.status });
  }
  return res.json();
}

// Alta de una materia. Si sale bien, React Router vuelve a correr el
// `clientLoader` y la lista se actualiza sola.
export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const res = await api.materias.$post({
    json: { nombre: String(form.get("nombre") ?? "") },
  });
  controlarAcceso(res);
  if (!res.ok) return { error: await mensajeDeError(res) };
  return { creada: (await res.json()).nombre };
}

export default function Materias({
  loaderData: materias,
  actionData,
}: Route.ComponentProps) {
  const enviando = useNavigation().state === "submitting";
  const formRef = useRef<HTMLFormElement>(null);

  // Después de crear una, el campo queda vacío para cargar la siguiente.
  useEffect(() => {
    if (actionData && "creada" in actionData) formRef.current?.reset();
  }, [actionData]);

  return (
    <main className={css({ maxW: "960px", mx: "auto", px: "6", py: "16" })}>
      <h1
        className={css({ fontSize: "3xl", fontWeight: "bold", color: "heading" })}
      >
        Materias
      </h1>

      <Form
        method="post"
        ref={formRef}
        className={css({ mt: "6", display: "flex", gap: "3", flexWrap: "wrap" })}
      >
        <label htmlFor="nombre" className={css({ srOnly: true })}>
          Nombre de la materia
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          maxLength={100}
          placeholder="Nombre de la materia"
          className={css({
            flex: "1",
            minW: "200px",
            px: "4",
            py: "2.5",
            rounded: "lg",
            borderWidth: "1px",
            borderColor: "border",
          })}
        />
        <Button
          type="submit"
          disabled={enviando}
          className={css({ display: "inline-flex" })}
        >
          {enviando ? "Guardando…" : "Agregar"}
        </Button>
      </Form>

      {actionData && "error" in actionData && (
        <p role="alert" className={css({ mt: "3", color: "danger" })}>
          {actionData.error}
        </p>
      )}
      {actionData && "creada" in actionData && (
        <p role="status" className={css({ mt: "3" })}>
          Se agregó «{actionData.creada}».
        </p>
      )}

      {materias.length === 0 ? (
        <p className={css({ mt: "8" })}>Todavía no hay materias.</p>
      ) : (
        <ul
          className={css({
            mt: "8",
            borderWidth: "1px",
            borderColor: "border",
            rounded: "lg",
          })}
        >
          {materias.map((m) => (
            <li
              key={m.id}
              className={css({
                px: "4",
                py: "3",
                display: "flex",
                justifyContent: "space-between",
                "&:not(:last-child)": { borderBottomWidth: "1px", borderColor: "border" },
              })}
            >
              {m.nombre}
              {!m.activo && <span className={css({ color: "text" })}>inactiva</span>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
