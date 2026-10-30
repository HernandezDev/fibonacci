import type { Config } from "@react-router/dev/config";

export default {
  // SPA: nada se renderiza en el servidor salvo la landing, que se prerenderiza
  ssr: false,
  prerender: ["/"],
} satisfies Config;
