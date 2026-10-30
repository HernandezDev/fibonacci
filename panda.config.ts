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
      // Roles semánticos: lo que usan los componentes. El modo oscuro sigue
      // la preferencia del sistema (_osDark), sin JavaScript.
      semanticTokens: {
        colors: {
          bg: {
            DEFAULT: { value: { base: '#f7fafc', _osDark: '{colors.gray.950}' } },
            muted: { value: { base: '#e0e3e5', _osDark: '{colors.gray.900}' } },
          },
          fg: {
            DEFAULT: { value: { base: '{colors.gray.900}', _osDark: '{colors.gray.50}' } },
            muted: { value: { base: '#43474e', _osDark: '{colors.gray.400}' } },
          },
          border: {
            DEFAULT: { value: { base: '{colors.gray.300}', _osDark: '{colors.gray.800}' } },
          },
          primary: {
            DEFAULT: { value: { base: '{colors.brand.navy}', _osDark: '{colors.blue.300}' } },
            fg: { value: { base: '#ffffff', _osDark: '{colors.gray.950}' } },
          },
          secondary: {
            DEFAULT: { value: { base: '{colors.brand.blue}', _osDark: '{colors.blue.400}' } },
            fg: { value: { base: '#ffffff', _osDark: '{colors.gray.950}' } },
          },
          danger: {
            DEFAULT: { value: { base: '{colors.red.600}', _osDark: '{colors.red.400}' } },
            fg: { value: { base: '#ffffff', _osDark: '{colors.gray.950}' } },
          },
        },
      },
    },
  },
  globalCss: {
    html: { colorScheme: 'light dark' },
    body: { fontFamily: 'inter' },
  },
  outdir: "styled-system",
})
