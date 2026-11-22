import { createContext, type ReactNode, useContext, useMemo } from "react";

import { authClient } from "./auth-client";
import { esFormatoHora, type FormatoHora } from "./regional";

// Cómo se muestran fechas y horas. El idioma es siempre español: el locale es
// `es-[PAÍS]`, y del navegador solo se toma el formato de hora (y la zona
// horaria, que nunca se fija). Prioridad del formato de hora: el elegido en el
// Perfil (`formatoHora`) > el del país (`PAISES_FORZAR_24_HORAS`) > el del
// navegador.

// Países donde se usa 24 horas aunque el navegador indique 12 (los datos de
// CLDR registran a Argentina en 12 horas). El usuario puede cambiarlo en el
// Perfil con `formatoHora`.
const PAISES_FORZAR_24_HORAS = new Set(["AR"]);

export function formatoHoraDelNavegador() {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions()
    .hourCycle;
}

export function formatoHoraPorDefecto(pais: string | null) {
  if (pais && PAISES_FORZAR_24_HORAS.has(pais)) return "h23";
  return formatoHoraDelNavegador();
}

export function construirLocale(
  pais: string | null,
  formatoHora: FormatoHora | null,
) {
  return new Intl.Locale("es", {
    region: pais ?? undefined,
    hourCycle: formatoHora ?? formatoHoraPorDefecto(pais),
  });
}

type Formato = {
  locale: Intl.Locale;
  hora: Intl.DateTimeFormat;
  fecha: Intl.DateTimeFormat;
};

const FormatoContext = createContext<Formato | null>(null);

// Va en el layout de las rutas SPA (`app/routes/spa/spa.tsx`), no en la
// landing: `useSession` llama a `/api/auth/get-session`. Sigue la sesión, así
// que toma solo los cambios del Perfil. Sin sesión, usa el navegador.
// Sin `timeZone`: siempre se usa la zona del navegador.
export function FormatoProvider({ children }: { children: ReactNode }) {
  const usuario = authClient.useSession().data?.user;
  const pais = usuario?.pais ?? null;
  const elegido = usuario?.formatoHora;
  const formatoHora = esFormatoHora(elegido) ? elegido : null;

  const formato = useMemo(() => {
    const locale = construirLocale(pais, formatoHora);
    return {
      locale,
      hora: new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
      }),
      fecha: new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    };
  }, [pais, formatoHora]);

  return (
    <FormatoContext.Provider value={formato}>{children}</FormatoContext.Provider>
  );
}

export function useFormato() {
  const formato = useContext(FormatoContext);
  if (!formato) {
    throw new Error("useFormato() tiene que usarse dentro de <FormatoProvider>.");
  }
  return formato;
}
