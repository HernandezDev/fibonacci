import {
  Link,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import type { InferRequestType } from "hono/client";
import { css } from "styled-system/css";
import { grid } from "styled-system/patterns";

import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { api, controlarAcceso, mensajeDeError } from "~/lib/api";
import { useLocale } from "~/lib/locale";
import { sesionContext } from "~/lib/sesion";

import type { Route } from "./+types/reservar";

export function meta() {
  return [{ title: "Reservar — Instituto Fibonacci" }];
}

type Materia = { id: string; nombre: string };

// Lo que manda cada card al `clientAction` (`useSubmit` con `encType:
// "application/json"`): el mismo cuerpo de `POST /api/turnos`, con el tipo que
// Hono RPC infiere del esquema `reservarTurno`. Lo valida la API.
type Reserva = InferRequestType<typeof api.turnos.$post>["json"];

// Un turno libre todavía no tiene `id`: profesor, inicio y materia lo
// identifican. Es la `key` de la card y dice cuál se está enviando.
const claveDe = (r: Reserva) => `${r.profesorId}-${r.iniciaEn}-${r.materiaId}`;

// Turnos libres de los próximos 7 días. Se piden una sola vez y sin filtro:
// el filtro por materia se aplica acá, en el cliente (son pocos datos). Sin
// sesión, a `/login`; sin el permiso `disponibilidad: listar`, la API responde
// 403 y `controlarAcceso` manda a `/home`.
export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  if (!context.get(sesionContext)) throw redirect("/login");

  const res = await api.turnos.disponibles.$get({ query: {} });
  controlarAcceso(res);
  if (!res.ok) {
    return { error: await mensajeDeError(res), turnos: [], materias: [] };
  }

  const turnos = (await res.json()).map((t) => ({
    ...t,
    inicio: new Date(t.inicio),
    fin: new Date(t.fin),
  }));

  // Las opciones del selector salen de los mismos turnos: todas sus materias,
  // sin repetir y por nombre. Así no hace falta otro endpoint.
  const porId = new Map<string, Materia>();
  for (const t of turnos) for (const m of t.materias) porId.set(m.id, m);
  const materias = [...porId.values()].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es"),
  );

  return { error: null, turnos, materias };
}

// Reservar el turno de una card. Si sale bien o mal, React Router vuelve a
// correr el loader: el turno reservado (o el que ya tomó otro) desaparece de la
// lista.
export async function clientAction({ request }: Route.ClientActionArgs) {
  const res = await api.turnos.$post({
    json: (await request.json()) as Reserva,
  });
  controlarAcceso(res);
  if (!res.ok) return { error: await mensajeDeError(res), reservado: null };

  const t = await res.json();
  return {
    error: null,
    reservado: {
      materia: t.materia.nombre,
      profesor: t.profesor.nombre,
      inicio: new Date(t.inicio),
    },
  };
}

// Cambiar `?materia=` no vuelve a pedir los turnos: el filtro es local. Lo
// demás (otra ruta, un envío de formulario) sigue el comportamiento normal.
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (!formMethod && currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

export default function Reservar({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { error, turnos, materias } = loaderData;
  const { fecha, hora } = useLocale();
  // Mientras se reserva uno, se deshabilitan todos los botones; el que se
  // envió dice "Reservando…".
  const navigation = useNavigation();
  const enviada = navigation.json && claveDe(navigation.json as Reserva);
  const submit = useSubmit();
  // La materia elegida vive en la URL: se puede compartir y sobrevive a una
  // recarga. Se lee acá y no en el loader, porque el loader no corre al
  // cambiarla.
  // Cada card es un turno de UNA materia: así el botón Reservar ya sabe qué
  // reservar. Con "Todas", un turno aparece una vez por cada materia que da el
  // profesor (maqueta: son muchas cards; se va a ajustar).
  const [params, setParams] = useSearchParams();
  const materiaId = params.get("materia") ?? "";
  const elegida = materias.find((m) => m.id === materiaId);

  const visibles = turnos.flatMap((t) =>
    t.materias
      .filter((m) => !materiaId || m.id === materiaId)
      .map((materia) => ({ ...t, materia })),
  );

  function elegir(id: string) {
    setParams(id ? { materia: id } : {}, {
      replace: true,
      preventScrollReset: true,
    });
  }

  return (
    <main className={css({ maxW: "960px", mx: "auto", px: "6", py: "16" })}>
      <h1
        className={css({
          fontSize: "3xl",
          fontWeight: "bold",
          color: "heading",
        })}
      >
        Reservar un turno
      </h1>

      {actionData?.reservado && (
        <p role="status" className={css({ mt: "6" })}>
          Reservaste {actionData.reservado.materia} con{" "}
          {actionData.reservado.profesor}, el{" "}
          {fecha.format(actionData.reservado.inicio)} a las{" "}
          {hora.format(actionData.reservado.inicio)}.
        </p>
      )}
      {actionData?.error && (
        <p role="alert" className={css({ mt: "6", color: "danger" })}>
          {actionData.error}
        </p>
      )}

      {error ? (
        <p role="alert" className={css({ mt: "6", color: "danger" })}>
          {error}
        </p>
      ) : turnos.length === 0 ? (
        <p className={css({ mt: "8" })}>
          No hay turnos libres en los próximos 7 días.
        </p>
      ) : (
        <>
          <label className={css({ mt: "8", display: "block", maxW: "sm" })}>
            Materia
            <select
              value={elegida ? materiaId : ""}
              onChange={(e) => elegir(e.target.value)}
              className={css({
                display: "block",
                w: "full",
                mt: "1",
                px: "4",
                py: "2.5",
                rounded: "lg",
                borderWidth: "1px",
                borderColor: "border",
                bg: "bg",
              })}
            >
              <option value="">Todas las materias</option>
              {materias.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>

          {visibles.length === 0 ? (
            // Solo pasa con una materia de la URL que no tiene turnos (o no
            // existe): las del selector salen de los mismos turnos.
            <p className={css({ mt: "8" })}>
              No hay turnos libres de esa materia en los próximos 7 días.{" "}
              <Link
                to="/alumno/reservar"
                replace
                className={css({ textDecoration: "underline" })}
              >
                Ver todas las materias
              </Link>
            </p>
          ) : (
            <div
              className={grid({
                mt: "8",
                columns: { base: 1, md: 2, lg: 3 },
                gap: "4",
              })}
            >
              {visibles.map((t) => {
                const reserva: Reserva = {
                  profesorId: t.profesor.id,
                  materiaId: t.materia.id,
                  iniciaEn: t.inicio.toISOString(),
                };
                const clave = claveDe(reserva);
                return (
                  <Card
                    key={clave}
                    tipo="turno"
                    titulo={t.materia.nombre}
                    subtitulo={t.profesor.nombre}
                    inicia={t.inicio}
                    termina={t.fin}
                    acciones={
                      <Button
                        disabled={navigation.state !== "idle"}
                        onClick={() =>
                          submit(reserva, {
                            method: "post",
                            encType: "application/json",
                          })
                        }
                      >
                        {enviada === clave ? "Reservando…" : "Reservar"}
                      </Button>
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
