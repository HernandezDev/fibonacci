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
          // Colores de marca: valores crudos, no se usan directo en componentes
          brand: {
            navy: { value: '#002045' },
            blue: { value: '#0061a5' },
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
            DEFAULT: { value: '#f7fafc' },
            muted: { value: '#e0e3e5' },
          },
          fg: {
            DEFAULT: { value: '{colors.gray.900}' },
            muted: { value: '#43474e' },
          },
          border: {
            DEFAULT: { value: '{colors.gray.300}' },
          },
          primary: {
            DEFAULT: { value: '{colors.brand.navy}' },
            fg: { value: '#ffffff' },
          },
          secondary: {
            DEFAULT: { value: '{colors.brand.blue}' },
            fg: { value: '#ffffff' },
          },
          danger: {
            DEFAULT: { value: '{colors.red.600}' },
            fg: { value: '#ffffff' },
          },
        },
      },
    },
  },
  globalCss: {
    html: { colorScheme: 'light' },
    body: { fontFamily: 'inter' },
  },
  outdir: "styled-system",
})
