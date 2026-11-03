import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ListIcon, XIcon } from "@phosphor-icons/react/ssr";
import { createPortal } from "react-dom";
import { css } from "styled-system/css";

type MobileMenuProps = {
  /** Contenido del panel. Recibe `close` para cerrar el menú al tocar un enlace. */
  children: (close: () => void) => ReactNode;
};

const overlay = css.raw({
  position: "fixed",
  inset: "0",
  zIndex: "40",
  bg: "black/50",
  transitionProperty: "opacity",
  transitionDuration: "300ms",
  md: { display: "none" },
});

// Sin caja propia: el botón sigue siendo hijo directo de la barra que lo contiene.
const root = css({ display: "contents" });

const menuButton = css({
  color: "heading",
  p: "2",
  md: { display: "none" },
});

// Se posiciona respecto del ancestro posicionado más cercano (la barra del header).
const panel = css({
  position: "absolute",
  top: "100%",
  left: "0",
  right: "0",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: "1",
  px: "6",
  pb: "4",
  bg: "bg",
  borderTopWidth: "1px",
  borderBottomWidth: "1px",
  borderColor: "border",
  md: { display: "none" },
});

export function MobileMenu({ children }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  // El portal necesita `document`: se monta recién en el cliente.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const close = () => setIsOpen(false);

  return (
    <div ref={rootRef} className={root}>
      {/* Portal: el header tiene `backdrop-filter`, que haría de `fixed` un
          "fixed respecto del header" y el fondo no cubriría la pantalla. */}
      {mounted &&
        createPortal(
          <div
            aria-hidden="true"
            className={css(overlay, {
              opacity: isOpen ? "1" : "0",
              pointerEvents: isOpen ? "auto" : "none",
            })}
            onClick={close}
          />,
          document.body,
        )}
      <button
        className={menuButton}
        aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? (
          <XIcon size={24} weight="regular" />
        ) : (
          <ListIcon size={24} weight="regular" />
        )}
      </button>
      {isOpen && (
        <nav id={panelId} className={panel}>
          {children(close)}
        </nav>
      )}
    </div>
  );
}
