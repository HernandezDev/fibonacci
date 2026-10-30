import { useEffect, useRef, useState } from "react";
import { ListIcon, X } from "@phosphor-icons/react/ssr";
import { css } from "styled-system/css";

import { useActiveSection } from "~/hooks/use-active-section";
import { Logo } from "./logo";

const LINKS = [
  { id: "inicio", label: "Inicio" },
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "precios", label: "Precios" },
  { id: "contacto", label: "Contacto" },
];
const SECTIONS = LINKS.map((link) => link.id);

const RESERVAR_HREF = "/turnos";

const overlay = css.raw({
  position: "fixed",
  inset: "0",
  zIndex: "40",
  bg: "black/50",
  transitionProperty: "opacity",
  transitionDuration: "300ms",
  md: { display: "none" },
});

const header = css({
  position: "fixed",
  top: "0",
  w: "full",
  zIndex: "50",
  bg: "bg/90",
  backdropFilter: "blur(24px)",
  borderBottomWidth: "1px",
  borderColor: "border",
});

const bar = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  px: { base: "6", md: "16" },
  py: "4",
  maxW: "1280px",
  mx: "auto",
  position: "relative",
  zIndex: "10",
});

const desktopNav = css({
  display: "none",
  alignItems: "center",
  gap: "8",
  md: { display: "flex" },
});

const desktopLink = css.raw({
  color: "text",
  transitionProperty: "color",
  transitionDuration: "200ms",
  _hover: { color: "heading" },
});

const desktopLinkActive = css.raw({
  color: "secondary",
  borderBottomWidth: "2px",
  borderColor: "secondary",
  pb: "1",
  transitionProperty: "color",
  transitionDuration: "200ms",
});

const button = css.raw({
  alignItems: "center",
  justifyContent: "center",
  px: "6",
  py: "2.5",
  bg: "primary",
  color: "primary.text",
  rounded: "lg",
});

const desktopCta = css(button, {
  display: "none",
  shadow: "md",
  transitionProperty: "colors",
  transitionDuration: "150ms",
  _hover: { bg: "primary/90" },
  md: { display: "inline-flex" },
});

const mobileCta = css(button, { display: "inline-flex", mt: "3" });

const menuButton = css({
  color: "heading",
  p: "2",
  md: { display: "none" },
});

const mobileNav = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: "1",
  px: "6",
  pb: "4",
  bg: "bg",
  borderTopWidth: "1px",
  borderColor: "border",
  md: { display: "none" },
});

const mobileLink = css.raw({
  py: "3",
  color: "text",
  borderBottomWidth: "1px",
  borderColor: "border",
});

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const activeId = useActiveSection(SECTIONS);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        headerRef.current &&
        !headerRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <>
      <div
        aria-hidden="true"
        className={css(overlay, {
          opacity: isMenuOpen ? "1" : "0",
          pointerEvents: isMenuOpen ? "auto" : "none",
        })}
        onClick={() => setIsMenuOpen(false)}
      />
      <header ref={headerRef} className={header}>
        <div className={bar}>
          <Logo />

          <nav className={desktopNav}>
            {LINKS.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className={css(
                  activeId === id ? desktopLinkActive : desktopLink,
                )}
              >
                {label}
              </a>
            ))}
          </nav>

          <a href={RESERVAR_HREF} className={desktopCta}>
            Reservar clase
          </a>

          <button
            className={menuButton}
            aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            {isMenuOpen ? (
              <X size={24} weight="regular" />
            ) : (
              <ListIcon size={24} weight="regular" />
            )}
          </button>
        </div>

        {isMenuOpen && (
          <nav className={mobileNav}>
            {LINKS.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setIsMenuOpen(false)}
                className={css(mobileLink, {
                  color: activeId === id ? "secondary" : "text",
                })}
              >
                {label}
              </a>
            ))}
            <a href={RESERVAR_HREF} className={mobileCta}>
              Reservar clase
            </a>
          </nav>
        )}
      </header>
    </>
  );
}
