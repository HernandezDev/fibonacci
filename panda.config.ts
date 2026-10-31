import { defineConfig } from '@pandacss/dev'

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
    },
  },
  globalCss: {
    html: { colorScheme: 'light' },
    body: { fontFamily: 'inter', bg: 'bg', color: 'text' },
  },
  outdir: "styled-system",
})
