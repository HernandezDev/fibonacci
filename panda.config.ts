import { defineConfig } from '@pandacss/dev'

/*
Reglas que conviene que sepan todos:
El punto navega la jerarquía. primary.text.muted es semanticTokens.colors.primary.text.muted. Los que tienen DEFAULT se usan sin sufijo (primary, bg, text).
Después de cambiar panda.config, hay que regenerar con npx panda codegen. Eso actualiza styled-system/ y el autocompletado de TypeScript, que además te marca los tokens inexistentes.
Panda analiza el código de forma estática: los valores deben ser literales. color: \${algo}`no funciona. Para variar estilos según una condición, se usan variantes delsva`. 
*/

export default defineConfig({
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda'],
  preflight: true,
  include: ['./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}'],
  exclude: [],
  theme: {
    extend: {
      tokens: {
        colors: {
          // Valores crudos: la única paleta del sitio. No se usan directo en
          // componentes; los roles de `semanticTokens` les dan su función.
          brand: {
            navy: { value: '#002045' },
            blue: { value: '#0061a5' },
          },
          neutral: {
            snow: { value: '#f7fafc' },
            mist: { value: '#e0e3e5' },
            slate: { value: '#43474e' },
          },
        },
        fonts: {
          inter: {
            value:
              '"Inter Variable", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          },
        },
      },
      // Roles semánticos: lo que usan los componentes. Solo modo claro por ahora;
      // para sumar el oscuro, pasar cada valor a { base, _osDark }.
      semanticTokens: {
        colors: {
          bg: {
            DEFAULT: { value: '{colors.neutral.snow}' },
            muted: { value: '{colors.neutral.mist}' },
          },
          text: {
            DEFAULT: { value: '{colors.neutral.slate}' },
          },
          // Títulos grandes: el navy de la marca como color de texto
          heading: { value: '{colors.brand.navy}' },
          border: { value: '{colors.neutral.mist}' },
          primary: {
            DEFAULT: { value: '{colors.brand.navy}' },
            text: {
              DEFAULT: { value: '{colors.white}' },
              // Blanco con transparencia, como en la landing anterior (white/70, white/50, white/10)
              muted: { value: '{colors.white/70}' },
              subtle: { value: '{colors.white/50}' },
            },
            border: { value: '{colors.white/10}' },
          },
          secondary: {
            DEFAULT: { value: '{colors.brand.blue}' },
            text: { value: '{colors.white}' },
          },
          danger: {
            DEFAULT: { value: '{colors.red.600}' },
            text: { value: '{colors.white}' },
          },
        },
      },
      // Tipografía reutilizable: `css({ textStyle: "titulo" })`. Solo tamaño,
      // peso y altura de línea; el color va aparte, con los roles semánticos.
      textStyles: {
        titulo: { value: { fontSize: 'lg', fontWeight: 'semibold', lineHeight: '1.4' } },
        detalle: { value: { fontSize: 'sm', lineHeight: '1.5' } },
      },
      // Superficies reutilizables (cards, casillas del calendario, el panel del
      // Drawer): `css({ layerStyle: "superficie.elevada" })`.
      layerStyles: {
        superficie: {
          elevada: {
            value: { bg: 'white', borderWidth: '1px', borderColor: 'border', boxShadow: 'sm' },
          },
          apagada: {
            value: { bg: 'bg.muted', borderWidth: '1px', borderColor: 'transparent' },
          },
        },
      },
    },
  },
  globalCss: {
    html: { colorScheme: 'light' },
    body: { fontFamily: 'inter', bg: 'bg', color: 'text' },
  },
  outdir: "styled-system",
})
