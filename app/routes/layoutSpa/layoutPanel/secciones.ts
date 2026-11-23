import type { DrawerSection } from "~/components/Drawer";
import type { Rol } from "~/shared/permisos";

// Secciones comunes del panel. `/home` es un redireccionador según el rol
// activo y Perfil mantiene su ruta real dentro del panel.
const SECCIONES_COMUNES: DrawerSection[] = [{ label: "Perfil", to: "/perfil" }];

// Qué secciones del drawer ve cada rol. Es solo configuración (datos): agregar
// una sección es agregar una línea acá y su ruta en `app/routes.ts`.
// Record<Rol, ...> obliga a definir secciones para TODOS los roles.
// Esto solo muestra u oculta el menú: quien decide el acceso real es la API.
//
// Solo van secciones cuya ruta ya existe. Agenda y disponibilidad se suman
// junto con sus rutas.
const SECCIONES_POR_ROL: Record<Rol, DrawerSection[]> = {
  alumno: [{ label: "Reservar clase", to: "/reservar" }],
  profesor: [],
  admin: [{ label: "Materias", to: "/admin/materias" }],
};

/** Secciones comunes más las del rol activo, no de todos los roles reales. */
export function seccionesPara(rolActivo: Rol | null): DrawerSection[] {
  if (!rolActivo) return SECCIONES_COMUNES;
  return [...SECCIONES_COMUNES, ...SECCIONES_POR_ROL[rolActivo]];
}