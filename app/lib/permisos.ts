import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

// Roles del plugin `admin` de Better Auth. Los usan el servidor
// (`workers/auth.ts`) y el cliente (`app/lib/auth-client.ts`), por eso viven en
// `app/`: el frontend no puede importar valores de `workers/`.
// Un usuario puede tener varios roles: se guardan separados por comas en
// `user.role` (por ejemplo "admin,profesor").
// `defaultStatements` son los permisos del plugin sobre usuarios y sesiones. Los
// de turnos se suman acá cuando exista esa tabla.
export const ac = createAccessControl({ ...defaultStatements });

export const roles = {
  admin: ac.newRole({ ...adminAc.statements }),
  profesor: ac.newRole({}),
  alumno: ac.newRole({}),
};
