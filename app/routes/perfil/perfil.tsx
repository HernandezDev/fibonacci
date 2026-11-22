import { Form, Link, redirect, useNavigation } from "react-router";
import { css } from "styled-system/css";

import { Button } from "~/components/Button";
import { authClient } from "~/lib/auth-client";
import { esFormatoHora, nombreDePais } from "~/shared/regional";
import { olvidarSesion, sesionContext } from "~/lib/sesion";

import { Avatar } from "./components/Avatar";
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

// Zonas horarias que conoce el navegador, con su diferencia con UTC de hoy
// ("GMT-03:00"). Se arma una vez, al cargar la vista. Usa los nombres de CLDR,
// que no siempre son los de Cloudflare ("America/Buenos_Aires" y no
// "America/Argentina/Buenos_Aires"): la del usuario se suma si no está.
const AHORA = new Date();
const ZONAS = Intl.supportedValuesOf("timeZone");

function etiquetaDeZona(zona: string) {
  const diferencia = new Intl.DateTimeFormat("es", {
    timeZone: zona,
    timeZoneName: "longOffset",
  })
    .formatToParts(AHORA)
    .find((p) => p.type === "timeZoneName")?.value;
  return `(${diferencia}) ${zona.replaceAll("_", " ")}`;
}

const ETIQUETAS_ZONAS = new Map(ZONAS.map((z) => [z, etiquetaDeZona(z)]));

function zonasPara(actual: string | null) {
  if (!actual || ETIQUETAS_ZONAS.has(actual)) return ETIQUETAS_ZONAS;
  return new Map(
    [...ETIQUETAS_ZONAS, [actual, etiquetaDeZona(actual)] as const].sort(
      ([a], [b]) => a.localeCompare(b),
    ),
  );
}

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
  const { name, email, image, pais, formatoHora, zonaHoraria } = sesion.user;
  return {
    name,
    email,
    image: image ?? null,
    pais: pais ?? null,
    formatoHora: esFormatoHora(formatoHora) ? formatoHora : null,
    zonaHoraria: zonaHoraria ?? null,
  };
}

// Better Auth valida en el servidor (`databaseHooks.user.update.before`) y
// responde 400 con el mensaje del primer error. Al guardar, se descarta la
// sesión en memoria: la próxima lectura trae los datos nuevos y el
// `LocaleProvider` los toma.
export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const pais = String(form.get("pais") ?? "");
  const zonaHoraria = String(form.get("zonaHoraria") ?? "");
  const formatoHora = String(form.get("formatoHora") ?? "auto");

  const res = await authClient.updateUser({
    name: String(form.get("name") ?? ""),
    // Sin país elegido no se manda: queda como está (`null`).
    pais: pais === "" ? undefined : pais,
    // "auto" (o cualquier otro valor) = `null`, automático.
    formatoHora: esFormatoHora(formatoHora) ? formatoHora : null,
    // Igual que el país: sin zona elegida no se manda.
    zonaHoraria: zonaHoraria === "" ? undefined : zonaHoraria,
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
      <div
        className={css({
          mt: "4",
          display: "flex",
          gap: "4",
          alignItems: "center",
        })}
      >
        <Avatar src={usuario.image} />
        <p>{usuario.email}</p>
      </div>

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

        <label>
          Zona horaria
          <select
            name="zonaHoraria"
            defaultValue={usuario.zonaHoraria ?? ""}
            className={campo}
          >
            {/* Como el país: solo si todavía no tiene zona. */}
            {!usuario.zonaHoraria && (
              <option value="" disabled>
                Elegí tu zona horaria
              </option>
            )}
            {[...zonasPara(usuario.zonaHoraria)].map(([zona, etiqueta]) => (
              <option key={zona} value={zona}>
                {etiqueta}
              </option>
            ))}
          </select>
          <span
            className={css({ display: "block", mt: "1", textStyle: "detalle" })}
          >
            Todas las horas de la app se muestran en esta zona.
          </span>
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
