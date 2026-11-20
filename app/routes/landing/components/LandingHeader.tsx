import { css, cva } from "styled-system/css";

import { useActiveSection } from "../hooks/use-active-section";
import { ButtonLink } from "~/components/Button";
import { Logo } from "~/components/Logo";
import { authClient } from "~/lib/auth-client";
import { rolesDe } from "~/lib/permisos";

import { MobileMenu } from "./MobileMenu";

const LINKS = [
  { id: "inicio", label: "Inicio" },
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "precios", label: "Precios" },
  { id: "contacto", label: "Contacto" },
];
const SECTIONS = LINKS.map((link) => link.id);

const RESERVAR_LINK = "/home";

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

const desktopActions = css({
  display: "none",
  md: { display: "inline-flex", alignItems: "center", gap: "3" },
});

const mobileCta = css({ display: "inline-flex", mt: "3" });

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
  const activeId = useActiveSection(SECTIONS);
  const { data: session } = authClient.useSession();
  const esAdmin = rolesDe(session?.user?.role).includes("admin");

  return (
    <header className={header}>
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

        <div className={desktopActions}>
          {esAdmin && (
            <ButtonLink to="/admin" prefetch="intent">
              Admin
            </ButtonLink>
          )}
          <ButtonLink to={RESERVAR_LINK} prefetch="intent">
            Reservar clase
          </ButtonLink>
        </div>

        <MobileMenu>
          {(close) => (
            <>
              {LINKS.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={close}
                  className={mobileLink({ active: activeId === id })}
                >
                  {label}
                </a>
              ))}
              {esAdmin && (
                <ButtonLink
                  to="/admin"
                  prefetch="intent"
                  onClick={close}
                  className={mobileCta}
                >
                  Admin
                </ButtonLink>
              )}
              <ButtonLink
                to={RESERVAR_LINK}
                prefetch="intent"
                onClick={close}
                className={mobileCta}
              >
                Reservar clase
              </ButtonLink>
            </>
          )}
        </MobileMenu>
      </div>
    </header>
  );
}