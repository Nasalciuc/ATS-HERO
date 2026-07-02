import type { Config } from "tailwindcss";

// The app's existing UI is built on a hand-written design system in app/styles.css.
// We add Tailwind for the newer component layer (CV template controls, export buttons)
// WITHOUT resetting that system: `preflight: false` disables Tailwind's global reset, so
// existing classes keep their exact look while utility classes become available alongside.
const config: Config = {
  corePlugins: { preflight: false },
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./views/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design tokens from CLAUDE.md (Figma source of truth).
        "page-bg": "#F5F3FF",
        "dark-section": "#2E2E2E",
        "features-bg": "#D6F7E2",
        "green-accent": "#00C450",
        "green-ring": "#00DE81",
        "green-light": "#D6F7E2",
        // Full scale: a bare string here would REPLACE Tailwind's violet-50…900,
        // silently breaking bg-violet-600 etc. used across the app UI.
        violet: {
          DEFAULT: "#725BFE",
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#D9D2FF",
          300: "#B2A5FF",
          400: "#9D8CFF",
          500: "#8672FE",
          600: "#725BFE",
          700: "#5F48E8",
          800: "#4B37C4",
          900: "#3B2BA6",
        },
        "violet-light": "#D9D2FF",
        "violet-muted": "#B2A5FF",
        error: "#FF6161",
        "text-primary": "#1A1A1A",
        "text-secondary": "#6B7280",
        border: "#E5E7EB",
        surface: "#FFFFFF",
      },
      fontFamily: {
        heading: ["Helvetica", "Arial", "sans-serif"],
        body: ["Helvetica", "Arial", "sans-serif"],
        badge: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
