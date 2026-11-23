import { css } from "styled-system/css";

import type { Rol } from "~/shared/permisos";

import { guardarRolActivo } from "~/lib/rolActivo";

const ETIQUETAS: Record<Rol, string> = {
  alumno: "Alumno",
  profesor: "Profesor",
  admin: "Administrador",
};

type SelectorDeRolProps = {
  roles: Rol[];
  activo: Rol | null;
  alCambiar: (rol: Rol) => void;
};

export function SelectorDeRol({ roles, activo, alCambiar }: SelectorDeRolProps) {
  if (roles.length < 2) return null;

  function cambiar(rol: Rol) {
    guardarRolActivo(rol);
    alCambiar(rol);
  }

  return (
    <div className={css({ mt: "4", px: "1" })}>
      <label>
        Rol activo
        <select
          value={activo ?? ""}
          onChange={(event) => {
            const rol = event.target.value as Rol;
            cambiar(rol);
          }}
          className={css({
            display: "block",
            w: "full",
            mt: "1",
            px: "3",
            py: "2",
            borderWidth: "1px",
            borderColor: "border",
            rounded: "md",
            bg: "bg",
          })}
        >
          {roles.map((rol) => (
            <option key={rol} value={rol}>
              {ETIQUETAS[rol]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
