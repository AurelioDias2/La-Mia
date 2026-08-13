import type { Config } from "tailwindcss";

// Design tokens for La Mia Dolce Vita — Gestão de Folgas
// This is an internal operations tool (not a marketing site), so the palette
// leans toward clarity and long-session comfort, with the bakery identity
// carried through the brand mark, the display type, and status colors —
// not through decoration on every screen.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        crosta: {
          50: "#FBF6EE",
          100: "#F4E9D3",
          400: "#C98A3E",
          500: "#B5732A",
          600: "#93591E",
        },
        vinho: {
          50: "#F7EEEF",
          400: "#8C3B49",
          500: "#6B2737",
          600: "#54202D",
          700: "#3D1721",
        },
        oliva: {
          50: "#EFF1E7",
          400: "#7C8C55",
          500: "#5B6B3A",
          600: "#465229",
        },
        carvao: {
          50: "#F5F4F2",
          100: "#E7E4DF",
          300: "#B9B2A6",
          500: "#5A5348",
          700: "#372F28",
          900: "#211B16",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "0.875rem",
      },
    },
  },
  plugins: [],
};

export default config;
