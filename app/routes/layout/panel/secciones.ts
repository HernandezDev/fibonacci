import type { DrawerSection } from "~/components/Drawer";
import type { Rol } from "~/lib/permisos";

// Secciones que ve cualquier usuario con sesión, sin importar el rol.
const SECCIONES_COMUNES: DrawerSection[] = [{ label: "Inicio", to: "/home" }];

// Qué secciones del drawer ve cada rol. Es solo configuración (datos): agregar
// una sección es agregar una línea acá y su ruta en `app/routes.ts`.
// Record<Rol, ...> obliga a definir secciones para TODOS los roles.
// Esto solo muestra u oculta el menú: quien decide el acceso real es la API.
//
// Solo van secciones cuya ruta ya existe. Las de alumno y profesor se agregan
// junto con sus rutas.
const SECCIONES_POR_ROL: Record<Rol, DrawerSection[]> = {
  alumno: [],
  profesor: [],
  admin: [{ label: "Materias", to: "/admin/materias" }],
};

/** Secciones comunes más las de todos los roles del usuario (puede tener varios). */
export function seccionesPara(roles: Rol[]): DrawerSection[] {
  return [...SECCIONES_COMUNES, ...roles.flatMap((rol) => SECCIONES_POR_ROL[rol])];
}