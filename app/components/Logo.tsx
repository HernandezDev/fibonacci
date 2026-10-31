import { FunctionIcon } from "@phosphor-icons/react/ssr";
import { css } from "styled-system/css";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "on-primary";
}

const SIZES = {
  sm: { fontSize: "lg", icon: 16 },
  md: { fontSize: "xl", icon: 20 },
  lg: { fontSize: "2xl", icon: 24 },
} as const;

const COLORS = {
  primary: "heading",
  "on-primary": "primary.text",
} as const;

export function Logo({ size = "md", variant = "primary" }: LogoProps) {
  const { fontSize, icon } = SIZES[size];
  const color = COLORS[variant];
  const textClass = css({
    fontSize,
    color,
    lineHeight: "none",
    letterSpacing: "tight",
  });

  return (
    <a
      href="#inicio"
      className={css({ display: "flex", alignItems: "flex-end" })}
      aria-label="Instituto Fibonacci"
    >
      <span className={textClass}>Instituto</span>
      <FunctionIcon
        aria-hidden="true"
        size={icon}
        weight="bold"
        className={css({ color, ml: "0.5", mr: "-1" })}
      />
      <span className={textClass}>ibonacci</span>
    </a>
  );
}
