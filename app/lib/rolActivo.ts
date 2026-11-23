import type { Rol } from "~/shared/permisos";

const CLAVE_ROL_ACTIVO = "fibonacci.rolActivo";

// Orden de preferencia al entrar o cuando todavía no hay una vista elegida:
// alumno, profesor, admin.
const PRIORIDAD: Rol[] = ["alumno", "profesor", "admin"];

export function obtenerRolActivo(roles: Rol[]): Rol | null {
  if (typeof window === "undefined") {
    return PRIORIDAD.find((rol) => roles.includes(rol)) ?? null;
  }

  const guardado = window.localStorage.getItem(CLAVE_ROL_ACTIVO);
  if (guardado && roles.includes(guardado as Rol)) {
    return guardado as Rol;
  }

  const activo = PRIORIDAD.find((rol) => roles.includes(rol)) ?? null;
  if (activo) window.localStorage.setItem(CLAVE_ROL_ACTIVO, activo);
  else window.localStorage.removeItem(CLAVE_ROL_ACTIVO);
  return activo;
}

export function guardarRolActivo(rol: Rol) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CLAVE_ROL_ACTIVO, rol);
  }
}

// Mientras no exista una pantalla propia de profesor, su panel principal es el Perfil.
export function rutaPrincipal(rol: Rol): string {
  if (rol === "alumno") return "/reservar";
  if (rol === "profesor") return "/perfil";
  return "/admin";
}
