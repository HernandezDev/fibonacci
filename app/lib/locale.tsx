import { createContext, type ReactNode, useContext, useMemo } from "react";

import {
  esFormatoHora,
  esZonaHoraria,
  type FormatoHora,
} from "~/shared/regional";

// Cómo se muestran fechas y horas. El idioma es siempre español: el locale es
// `es-[PAÍS]`. Prioridad del formato de hora: el elegido en el Perfil
// (`formatoHora`) > el del país (`PAISES_FORZAR_24_HORAS`) > el del navegador.
// Zona horaria: la del Perfil (`zonaHoraria`), así las horas no dependen del
// dispositivo; la del navegador solo si el usuario todavía no tiene una.

// Países donde se usa 24 horas aunque el navegador indique 12 (los datos de
// CLDR registran a Argentina en 12 horas). El usuario puede cambiarlo en el
// Perfil con `formatoHora`.
const PAISES_FORZAR_24_HORAS = new Set(["AR"]);

export function formatoHoraDelNavegador() {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
  }).resolvedOptions().hourCycle;
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

// Lo que entrega `useLocale()`: el locale, la zona en uso y los formateadores
// ya armados con ellos. `zona` sirve para cálculos propios (por ejemplo, qué
// día es un turno) con la misma zona que se muestra.
type Locale = {
  locale: Intl.Locale;
  zona: string;
  hora: Intl.DateTimeFormat;
  fecha: Intl.DateTimeFormat;
};

const LocaleContext = createContext<Locale | null>(null);

type Preferencias = {
  pais?: string | null;
  formatoHora?: string | null;
  zonaHoraria?: string | null;
};

// Lo monta el layout de las rutas SPA (`app/routes/spa/spa.tsx`) con el usuario
// de la sesión; sin sesión (`undefined`), usa el navegador. Cuando el Perfil
// guarda, React Router vuelve a correr los loaders y llega el usuario nuevo:
// el cambio de zona o de formato se ve sin recargar.
export function LocaleProvider({
  usuario,
  children,
}: {
  usuario: Preferencias | undefined;
  children: ReactNode;
}) {
  const pais = usuario?.pais ?? null;
  const elegido = usuario?.formatoHora;
  const formatoHora = esFormatoHora(elegido) ? elegido : null;
  // Una zona inválida (no debería llegar: el servidor la valida) se ignora en
  // vez de romper los formateadores.
  const delPerfil = usuario?.zonaHoraria;
  const zonaPerfil = esZonaHoraria(delPerfil) ? delPerfil : null;

  const valor = useMemo(() => {
    const locale = construirLocale(pais, formatoHora);
    const zona =
      zonaPerfil ?? new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      locale,
      zona,
      hora: new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: zona,
      }),
      fecha: new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: zona,
      }),
    };
  }, [pais, formatoHora, zonaPerfil]);

  return (
    <LocaleContext.Provider value={valor}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const valor = useContext(LocaleContext);
  if (!valor) {
    throw new Error("useLocale() tiene que usarse dentro de <LocaleProvider>.");
  }
  return valor;
}
