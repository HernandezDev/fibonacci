import { Form, Link, redirect, useNavigation } from "react-router";
import { css } from "styled-system/css";

import { Button } from "~/components/Button";
import { authClient } from "~/lib/auth-client";
import { esFormatoHora, nombreDePais } from "~/lib/regional";
import { olvidarSesion, sesionContext } from "~/lib/sesion";

import type { Route } from "./+types/perfil";

export function meta() {
  return [{ title: "Perfil — Instituto Fibonacci" }];
}

// Todos los países con nombre en español, ordenados. Se arma una vez, al cargar
// la vista.
const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PAISES = [...LETRAS]
  .flatMap((a) => [...LETRAS].map((b) => a + b))
  .flatMap((codigo) => {
    const nombre = nombreDePais(codigo);
    return nombre ? [{ codigo, nombre }] : [];
  })
  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

// "auto" en el formulario = `null` en la base.
const FORMATOS = [
  { valor: "auto", etiqueta: "Automático" },
  { valor: "h12", etiqueta: "12 horas" },
  { valor: "h23", etiqueta: "24 horas" },
] as const;

// La misma vista para alumno y profesor. Sin sesión, a `/login`. La sesión la
// cargó el layout `spa.tsx`.
export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const sesion = context.get(sesionContext);
  if (!sesion) throw redirect("/login");
  const { name, email, pais, formatoHora } = sesion.user;
  return {
    name,
    email,
    pais: pais ?? null,
    formatoHora: esFormatoHora(formatoHora) ? formatoHora : null,
  };
}

// Better Auth valida en el servidor (`databaseHooks.user.update.before`) y
// responde 400 con el mensaje del primer error. Al guardar, se descarta la
// sesión en memoria: la próxima lectura trae los datos nuevos y el
// `LocaleProvider` los toma.
export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const pais = String(form.get("pais") ?? "");
  const formatoHora = String(form.get("formatoHora") ?? "auto");

  const res = await authClient.updateUser({
    name: String(form.get("name") ?? ""),
    // Sin país elegido no se manda: queda como está (`null`).
    pais: pais === "" ? undefined : pais,
    // "auto" (o cualquier otro valor) = `null`, automático.
    formatoHora: esFormatoHora(formatoHora) ? formatoHora : null,
  });
  if (res.error) {
    return {
      error: res.error.message ?? "No se pudo guardar. Probá de nuevo.",
    };
  }
  olvidarSesion();
  return { guardado: true };
}

const campo = css({
  display: "block",
  w: "full",
  mt: "1",
  px: "4",
  py: "2.5",
  rounded: "lg",
  borderWidth: "1px",
  borderColor: "border",
  bg: "bg",
});

export default function Perfil({
  loaderData: usuario,
  actionData,
}: Route.ComponentProps) {
  const enviando = useNavigation().state === "submitting";

  return (
    <main className={css({ maxW: "640px", mx: "auto", px: "6", py: "16" })}>
      <Link to="/home" className={css({ textDecoration: "underline" })}>
        ← Inicio
      </Link>
      <h1
        className={css({
          mt: "4",
          fontSize: "3xl",
          fontWeight: "bold",
          color: "heading",
        })}
      >
        Perfil
      </h1>
      {/* El email y la foto vienen de Google y no se editan. */}
      <p className={css({ mt: "3" })}>{usuario.email}</p>

      <Form
        method="post"
        className={css({ mt: "8", display: "grid", gap: "6" })}
      >
        <label>
          Nombre
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={usuario.name}
            className={campo}
          />
        </label>

        <label>
          País
          <select
            name="pais"
            defaultValue={usuario.pais ?? ""}
            className={campo}
          >
            {/* Solo para quien todavía no tiene país: no se puede elegir, así
                que una vez elegido no se vuelve a "sin país". */}
            {!usuario.pais && (
              <option value="" disabled>
                Elegí tu país
              </option>
            )}
            {PAISES.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend>Formato de hora</legend>
          <div className={css({ mt: "2", display: "grid", gap: "2" })}>
            {FORMATOS.map((f) => (
              <label
                key={f.valor}
                className={css({
                  display: "flex",
                  gap: "2",
                  alignItems: "center",
                })}
              >
                <input
                  type="radio"
                  name="formatoHora"
                  value={f.valor}
                  defaultChecked={(usuario.formatoHora ?? "auto") === f.valor}
                />
                {f.etiqueta}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <Button
            type="submit"
            disabled={enviando}
            className={css({ display: "inline-flex" })}
          >
            {enviando ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </Form>

      {actionData && "error" in actionData && (
        <p role="alert" className={css({ mt: "4", color: "danger" })}>
          {actionData.error}
        </p>
      )}
      {actionData && "guardado" in actionData && (
        <p role="status" className={css({ mt: "4" })}>
          Cambios guardados.
        </p>
      )}
    </main>
  );
}
