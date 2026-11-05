import { css } from "styled-system/css";

const wrapper = css({
  position: "fixed",
  inset: "0",
  zIndex: "1",
  pointerEvents: "none",
  overflow: "hidden",
});

const layer = css({
  position: "absolute",
  inset: "0",
  mixBlendMode: "multiply",
});

const line = css({ stroke: "secondary" });

export function DiagonalDashBackground() {
  return (
    <div className={wrapper} aria-hidden="true">
      {/* Capa de fondo: tile chico, líneas irregulares, tenues */}
      <svg
        width="100%"
        height="100%"
        className={`${layer} ${css({ opacity: "0.15" })}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="diagonal-dashes-small"
            width="220"
            height="220"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="220"
              y2="220"
              className={line}
              strokeWidth="1"
              strokeDasharray="8,8"
            />
            <line
              x1="30"
              y1="0"
              x2="250"
              y2="220"
              className={line}
              strokeWidth="1"
              strokeDasharray="8,8"
            />
            <line
              x1="95"
              y1="0"
              x2="315"
              y2="220"
              className={line}
              strokeWidth="0.75"
              strokeDasharray="6,6"
            />
            <line
              x1="140"
              y1="0"
              x2="360"
              y2="220"
              className={line}
              strokeWidth="0.75"
              strokeDasharray="6,6"
            />
            <line
              x1="15"
              y1="0"
              x2="-205"
              y2="220"
              className={line}
              strokeWidth="1"
              strokeDasharray="8,8"
            />
            <line
              x1="70"
              y1="0"
              x2="-150"
              y2="220"
              className={line}
              strokeWidth="0.75"
              strokeDasharray="6,6"
            />
            <line
              x1="90"
              y1="0"
              x2="-130"
              y2="220"
              className={line}
              strokeWidth="0.75"
              strokeDasharray="6,6"
            />
            <line
              x1="180"
              y1="0"
              x2="-40"
              y2="220"
              className={line}
              strokeWidth="1"
              strokeDasharray="8,8"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#diagonal-dashes-small)" />
      </svg>

      {/* Capa de primer plano: tile grande, pocas líneas, más nítidas */}
      <svg
        width="100%"
        height="100%"
        className={`${layer} ${css({ opacity: "0.4" })}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="diagonal-dashes-large"
            width="520"
            height="520"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="520"
              y2="520"
              className={line}
              strokeWidth="2"
              strokeDasharray="16,16"
            />
            <line
              x1="220"
              y1="0"
              x2="740"
              y2="520"
              className={line}
              strokeWidth="2"
              strokeDasharray="16,16"
            />
            <line
              x1="90"
              y1="0"
              x2="-430"
              y2="520"
              className={line}
              strokeWidth="2"
              strokeDasharray="16,16"
            />
            <line
              x1="380"
              y1="0"
              x2="-140"
              y2="520"
              className={line}
              strokeWidth="2"
              strokeDasharray="16,16"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#diagonal-dashes-large)" />
      </svg>
    </div>
  );
}
