import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

// Roles del plugin `admin` de Better Auth. Los usan el servidor
// (`workers/auth.ts`) y el cliente (`app/lib/auth-client.ts`), por eso viven en
// `app/shared/`: el frontend no puede importar valores de `workers/`, y
// `workers/` solo importa de acá.
// Un usuario puede tener varios roles: se guardan separados por comas en
// `user.role` (por ejemplo "admin,profesor").

// Catálogo: qué acciones existen sobre cada recurso. `defaultStatements` son las
// del plugin sobre usuarios y sesiones (en inglés); las nuestras, en español.
const catalogo = {
  ...defaultStatements,
  materia: ["listar", "crear"],
  // Turnos libres de los profesores, para reservar.
  disponibilidad: ["listar"],
  // Reservar un turno libre para uno mismo.
  turno: ["reservar"],
} as const;

export const ac = createAccessControl(catalogo);

// Qué parte del catálogo tiene cada rol.
export const roles = {
  admin: ac.newRole({
    ...adminAc.statements,
    materia: ["listar", "crear"],
    disponibilidad: ["listar"],
  }),
  profesor: ac.newRole({}),
  alumno: ac.newRole({ disponibilidad: ["listar"], turno: ["reservar"] }),
};

// Nombre de un rol: "admin" | "profesor" | "alumno". Se deriva de `roles`, así
// que agregar un rol ahí lo suma acá solo.
export type Rol = keyof typeof roles;

// Lo que pide una ruta, por ejemplo `{ materia: ["crear"] }`. Una acción que no
// está en el catálogo es error de tipos.
export type Permisos = {
  [R in keyof typeof catalogo]?: (typeof catalogo)[R][number][];
};

export function esRol(rol: string): rol is Rol {
  return Object.hasOwn(roles, rol);
}

// Los roles de un usuario, de "admin,profesor" a ["admin", "profesor"]. Descarta
// lo que no sea un rol conocido.
export function rolesDe(rol: string | null | undefined) {
  return (rol ?? "").split(",").filter(esRol);
}

// ¿Alguno de los roles del usuario tiene estos permisos? En el servidor decide
// (`conSesion`, `workers/sesion.ts`); en el cliente solo muestra u oculta cosas.
// Usa `authorize`, el evaluador que `auth.api.userHasPermission` corre por
// dentro: es síncrono y no consulta la base.
export function puede(rol: string | null | undefined, permisos: Permisos) {
  return rolesDe(rol).some((r) => roles[r].authorize(permisos).success);
}
