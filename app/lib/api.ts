import { hc } from "hono/client";
import { redirect } from "react-router";

import type { AppType } from "../../workers/api"; // import type, nunca valores
import { olvidarSesion } from "./sesion";

// Mismo origen: la cookie de sesión viaja sola.
export const api = hc<AppType>("/").api;

// Para usar en `clientLoader` y `clientAction` después de cada llamada: sin
// sesión (401) va a `/login` y sin permiso (403), a `/home`. Esos estados los
// responde `conSesion` (un middleware) y el RPC no los incluye en los tipos de
// la respuesta, por eso se miran acá con `status: number`. En los dos casos la
// sesión guardada en memoria quedó vieja (vencida, revocada o con otro rol), así
// que se descarta antes de redirigir.
export function controlarAcceso(res: { status: number }) {
  if (res.status === 401 || res.status === 403) olvidarSesion();
  if (res.status === 401) throw redirect("/login");
  if (res.status === 403) throw redirect("/home");
}

// Mensaje de una respuesta de error de la API (`{ error }`). Si la respuesta no
// trae ese formato (por ejemplo, un 502 de Cloudflare), un mensaje genérico.
export async function mensajeDeError(res: { json(): Promise<unknown> }) {
  const cuerpo: unknown = await res.json().catch(() => null);
  if (
    typeof cuerpo === "object" &&
    cuerpo !== null &&
    "error" in cuerpo &&
    typeof cuerpo.error === "string"
  ) {
    return cuerpo.error;
  }
  return "Algo salió mal. Probá de nuevo.";
}
