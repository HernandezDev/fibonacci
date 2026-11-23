import { useEffect, useId, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react/ssr";
import { NavLink } from "react-router";
import { sva } from "styled-system/css";

import { Button } from "~/components/Button";

/* -------------------------------------------------------------------------- */
/* 1. ESTILOS (slot recipe)                                                   */
/* -------------------------------------------------------------------------- */
/*
 * sva = "slot variant authoring": define los estilos de varias partes (slots)
 * del mismo componente en un solo lugar. Panda genera el CSS en build-time.
 *
 * Los colores salen de los semantic tokens de panda.config (bg, text, heading,
 * border, primary...). Nunca valores crudos como "#fff" o "gray.100": si
 * mañana cambia la paleta, se cambia en panda.config y no acá.
 *
 * Responsive: mobile-first. `base` es el valor para pantallas chicas y cada
 * breakpoint (sm, md, lg...) lo pisa de ese ancho para arriba.
 */
const drawerStyles = sva({
  slots: ["overlay", "panel", "header", "title", "closeButton", "body", "list", "link"],
  base: {
    // El <dialog> ES el overlay: ocupa toda la pantalla y es transparente.
    // Lo que no sea el panel cuenta como "afuera" (un click ahí cierra).
    // No definimos `display`: así el navegador conserva display:none cuando
    // el dialog está cerrado.
    overlay: {
      position: "fixed",
      inset: 0,
      width: "100%",
      height: "100%",
      maxWidth: "none", // el <dialog> trae un max-width por defecto
      maxHeight: "none",
      margin: 0,
      padding: 0,
      border: "none",
      background: "transparent",
      color: "inherit",
      // ::backdrop es el fondo oscuro que dibuja el navegador detrás del modal
      _backdrop: { background: "black/50" },
    },
    panel: {
      position: "fixed",
      top: 0,
      left: 0,
      display: "flex",
      flexDirection: "column",
      height: "100dvh", // dvh: respeta la barra del navegador en celulares
      // Responsive: en celular ocupa casi todo el ancho; desde `sm`, 20rem fijos
      width: { base: "85vw", sm: "20rem" },
      background: "bg",
      color: "text",
      boxShadow: "lg",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: { base: "3", md: "4" },
      borderBottom: "1px solid",
      borderColor: "border",
    },
    title: { fontSize: "lg", fontWeight: "semibold", color: "heading" },
    // El aspecto lo da <Button variant="icon">; acá solo el `display`, que
    // Button deja a cargo de quien lo usa.
    closeButton: { display: "inline-flex" },
    body: {
      flex: "1", // ocupa el espacio que sobra en el panel
      overflowY: "auto", // si hay muchas secciones, scrollea solo el body
      padding: "2",
    },
    list: { display: "flex", flexDirection: "column", gap: "1" },
    link: {
      display: "flex",
      alignItems: "center",
      gap: "3",
      padding: "3",
      borderRadius: "md",
      textDecoration: "none",
      color: "inherit",
      _hover: { background: "bg.muted" },
      // NavLink agrega aria-current="page" al link de la ruta activa;
      // _currentPage es el selector &[aria-current=page]. Sin JS.
      _currentPage: { background: "primary", color: "primary.text" },
    },
  },
});

/* -------------------------------------------------------------------------- */
/* 2. TIPOS (la API pública del componente)                                   */
/* -------------------------------------------------------------------------- */

/** Una entrada del menú: texto, ícono opcional y ruta de destino. */
export type DrawerSection = {
  label: string;
  to: string; // ruta de React Router, ej: "/profesor/disponibilidad"
  icon?: ReactNode;
};

type DrawerProps = {
  /** Estado controlado por el padre: ¿está abierto? */
  open: boolean;
  /** El padre lo implementa como () => setOpen(false) */
  onClose: () => void;
  /** Texto del header; también es el nombre accesible del dialog */
  title?: string;
  /** Lista de secciones de navegación (opcional) */
  sections?: DrawerSection[];
  /** Contenido libre (opcional); se muestra debajo de las secciones */
  children?: ReactNode;
};

/* -------------------------------------------------------------------------- */
/* 3. COMPONENTE                                                              */
/* -------------------------------------------------------------------------- */

export function Drawer({ open, onClose, title = "Menú", sections, children }: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId(); // id único para aria-labelledby
  const styles = drawerStyles(); // { overlay: "clase", panel: "clase", ... }

  // React → DOM: el <dialog> tiene su propio estado interno (atributo `open`)
  // que React no controla. Traducimos la prop `open` a llamadas imperativas.
  // Los `if` evitan showModal() doble (lanza error) y close() redundante.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal(); // focus trap + backdrop + Esc
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Click afuera: el click sobre el backdrop cae en el <dialog> mismo
  // (target === currentTarget). Un click dentro del panel no cierra.
  function handleOverlayClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.overlay}
      aria-labelledby={titleId}
      onClick={handleOverlayClick}
      // DOM → React: `close` se dispara siempre que el dialog se cierra (Esc,
      // dialog.close()...). Así el estado del padre nunca queda desfasado.
      onClose={onClose}
    >
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <Button variant="icon" className={styles.closeButton} onClick={onClose} aria-label="Cerrar menú">
            <XIcon size={20} weight="bold" />
          </Button>
        </header>

        <div className={styles.body}>
          {sections && sections.length > 0 && (
            <nav aria-label="Secciones">
              <ul className={styles.list}>
                {sections.map((section) => (
                  <li key={section.to}>
                    {/* NavLink navega sin recargar y marca el link activo.
                        onClick={onClose} cierra el drawer al navegar. */}
                    <NavLink to={section.to} className={styles.link} onClick={onClose}>
                      {section.icon}
                      <span>{section.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {children}
        </div>
      </div>
    </dialog>
  );
}