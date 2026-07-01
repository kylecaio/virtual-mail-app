import type { Config } from "tailwindcss";
// Single baked-in theme: "Balanced" (from the prototype). No theme-switcher.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FAF8F3", surface: "#FFFFFF", surfaceAlt: "#F4F1EA",
        border: "#E8E3D6", borderStrong: "#D4CDB8",
        ink: "#1F2733", inkMuted: "#5E6575", inkSubtle: "#9B9E9A",
        accent: "#2C4A7C", accentHover: "#1F3A68", accentSubtle: "#E8EEF8",
      },
      borderRadius: { theme: "10px" },
      fontFamily: {
        sans: ["Inter", "-apple-system", "system-ui", "sans-serif"],
        serif: ["'Source Serif 4'", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
