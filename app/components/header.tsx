import { useEffect, useRef, useState } from "react";
import { ListIcon, X } from "@phosphor-icons/react/ssr";
import { Link } from "react-router";
import { css, cva } from "styled-system/css";

import { useActiveSection } from "~/hooks/use-active-section";
import { Logo } from "./logo";

const LINKS = [
  { id: "inicio", label: "Inicio" },
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "precios", label: "Precios" },
  { id: "contacto", label: "Contacto" },
];
const SECTIONS = LINKS.map((link) => link.id);

const RESERVAR_LINK = "/turnos";

const overlay = cva({
  base: {
    position: "fixed",
    inset: "0",
    zIndex: "40",
    bg: "black/50",
    transitionProperty: "opacity",
    transitionDuration: "300ms",
    md: { display: "none" },
  },
  variants: {
    open: {
      true: { opacity: "1", pointerEvents: "auto" },
      false: { opacity: "0", pointerEvents: "none" },
    },
  },
  defaultVariants: { open: false },
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

const desktopLink = cva({
  base: {
    transitionProperty: "color",
    transitionDuration: "200ms",
  },
  variants: {
    active: {
      true: {
        color: "secondary",
        borderBottomWidth: "2px",
        borderColor: "secondary",
        pb: "1",
      },
      false: {
        color: "text",
        _hover: { color: "heading" },
      },
    },
  },
  defaultVariants: { active: false },
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

const mobileLink = cva({
  base: {
    py: "3",
    borderBottomWidth: "1px",
    borderColor: "border",
  },
  variants: {
    active: {
      true: { color: "secondary" },
      false: { color: "text" },
    },
  },
  defaultVariants: { active: false },
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
        className={overlay({ open: isMenuOpen })}
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
                className={desktopLink({ active: activeId === id })}
              >
                {label}
              </a>
            ))}
          </nav>

          <Link to={RESERVAR_LINK} prefetch="intent" className={desktopCta}>
            Reservar clase
          </Link>

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
                className={mobileLink({ active: activeId === id })}
              >
                {label}
              </a>
            ))}
            <Link to={RESERVAR_LINK} prefetch="intent" className={mobileCta}>
              Reservar clase
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}
