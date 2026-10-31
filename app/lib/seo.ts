interface SeoProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
}

const SITE_NAME = "Instituto Fibonacci";

// Tags comunes de SEO y redes sociales para el `meta` de una ruta pública.
// Las rutas SPA no lo necesitan: les alcanza con `[{ title }]`.
export function seo({ title, description, image, url }: SeoProps) {
  return [
    { title },
    ...(description ? [{ name: "description", content: description }] : []),

    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: title },
    ...(description
      ? [{ property: "og:description", content: description }]
      : []),
    ...(image ? [{ property: "og:image", content: image }] : []),
    ...(url ? [{ property: "og:url", content: url }] : []),

    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    ...(description
      ? [{ name: "twitter:description", content: description }]
      : []),
    ...(image ? [{ name: "twitter:image", content: image }] : []),
  ];
}
