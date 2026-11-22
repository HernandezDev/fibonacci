// País y formato de hora del usuario. Lo usan el Worker (validación y país de
// Cloudflare) y el cliente (Perfil y `locale.tsx`), por eso está en
// `app/shared/`: el frontend no puede importar valores de `workers/`, y
// `workers/` solo importa de acá.

// Formatos de hora que se pueden elegir en el Perfil. `null` = automático.
export const FORMATOS_HORA = ["h12", "h23"] as const;
export type FormatoHora = (typeof FORMATOS_HORA)[number];

export function esFormatoHora(valor: unknown): valor is FormatoHora {
  return FORMATOS_HORA.includes(valor as FormatoHora);
}

// Códigos que `Intl.DisplayNames` reconoce pero no son países: agrupaciones
// (EU, EZ, QO, UN), pseudolocales (XA, XB), "región desconocida" (ZZ) y los
// territorios que ISO 3166 tiene como reservas excepcionales (AC, CP, CQ, DG,
// EA, IC, TA). Los de Cloudflare sin país ("XX", "T1" de Tor) ya no tienen
// nombre o no son letras.
const NO_SON_PAISES = new Set([
  "EU",
  "EZ",
  "QO",
  "UN",
  "XA",
  "XB",
  "ZZ",
  "AC",
  "CP",
  "CQ",
  "DG",
  "EA",
  "IC",
  "TA",
]);

const nombres = new Intl.DisplayNames(["es"], {
  type: "region",
  fallback: "none",
});

// Nombre en español de un código ISO 3166-1 alfa-2 en mayúsculas ("AR" →
// "Argentina"), o `undefined` si no es un país.
export function nombreDePais(codigo: string): string | undefined {
  if (!/^[A-Z]{2}$/.test(codigo) || NO_SON_PAISES.has(codigo)) return undefined;
  // Códigos viejos o alias ("SU", "UK", "YU"…): Intl los normaliza al actual,
  // y DisplayNames les da el mismo nombre que al país vigente.
  if (new Intl.Locale(`und-${codigo}`).region !== codigo) return undefined;
  return nombres.of(codigo);
}

export function esPais(codigo: unknown): codigo is string {
  return typeof codigo === "string" && nombreDePais(codigo) !== undefined;
}
