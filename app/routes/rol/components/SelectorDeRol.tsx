import { css } from "styled-system/css";

import type { Rol } from "~/shared/permisos";

const ETIQUETAS: Record<Rol, string> = {
  alumno: "Alumno",
  profesor: "Profesor",
  admin: "Administrador",
};

type SelectorDeRolProps = {
  roles: Rol[];
  activo: Rol;
  alCambiar: (rol: Rol) => void;
};

// Con un solo rol no hay nada que elegir. El rol activo es el de la URL: el
// selector solo avisa al padre, que navega al otro panel.
export function SelectorDeRol({ roles, activo, alCambiar }: SelectorDeRolProps) {
  if (roles.length < 2) return null;

  return (
    <div className={css({ mt: "4", px: "1" })}>
      <label>
        Rol activo
        <select
          value={activo}
          onChange={(event) => alCambiar(event.target.value as Rol)}
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
