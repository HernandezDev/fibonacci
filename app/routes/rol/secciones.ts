import type { DrawerSection } from "~/components/Drawer";
import type { Rol } from "~/shared/permisos";

// Qué secciones del Drawer ve cada rol, en orden: la primera es la pantalla
// principal del panel (a donde lleva `/<rol>` a secas). Agregar una es sumar una
// línea acá y su ruta en `app/routes.ts`, dentro del rol.
// Record<Rol, ...> obliga a definir secciones para TODOS los roles.
// Esto solo muestra u oculta el menú: quien decide el acceso real es la API.
const SECCIONES_POR_ROL: Record<Rol, DrawerSection[]> = {
  alumno: [{ label: "Reservar clase", to: "/alumno/reservar" }],
  profesor: [],
  admin: [{ label: "Materias", to: "/admin/materias" }],
};

/** Las secciones del rol más el Perfil, que tienen todos. */
export function seccionesPara(rol: Rol): DrawerSection[] {
  return [...SECCIONES_POR_ROL[rol], { label: "Perfil", to: `/${rol}/perfil` }];
}
