import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  // hover só em aparelho com mouse: no celular o "hover" ficava grudado depois do toque
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        carvao: "#17181C",
        papel: "#F6F4EF",
        pedra: "#E7E3DC",
        grafite: "#5E5C57",
        areia: "#C8A574",
        "areia-escura": "#8E6F43",
        estado: {
          verde: "#3F7A5F",
          laranja: "#D08A4E",
          vermelho: "#B65A52",
          azul: "#4F73A0",
        },
        // cores do estabelecimento (white-label), definidas por variável CSS
        marca: {
          DEFAULT: "rgb(var(--cor-primaria) / <alpha-value>)",
          texto: "rgb(var(--cor-primaria-texto) / <alpha-value>)",
          sec: "rgb(var(--cor-secundaria) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["'Manrope Variable'", "system-ui", "sans-serif"],
        serif: ["'Instrument Serif'", "Georgia", "serif"],
      },
      borderRadius: { xl2: "18px" },
      boxShadow: { suave: "0 1px 2px rgba(23,24,28,.04), 0 8px 24px rgba(23,24,28,.06)" },
      keyframes: {
        pulsar: { "0%,100%": { boxShadow: "0 0 0 0 rgba(208,138,78,.55)" }, "50%": { boxShadow: "0 0 0 10px rgba(208,138,78,0)" } },
      },
      animation: { pulsar: "pulsar 1.4s ease-in-out infinite" },
    },
  },
  plugins: [],
} satisfies Config;
