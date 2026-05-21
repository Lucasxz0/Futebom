import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1D4ED8",
          light: "#3B82F6",
          dark: "#1E40AF",
        },
        background: {
          DEFAULT: "#0F172A",
          secondary: "#1E293B",
          tertiary: "#263348",
        },
        surface: {
          DEFAULT: "#1E293B",
          elevated: "#263348",
          border: "#334155",
        },
        accent: {
          blue: "#3B82F6",
          cyan: "#22D3EE",
          green: "#22C55E",
          red: "#EF4444",
          yellow: "#EAB308",
        },
        text: {
          primary: "#F1F5F9",
          secondary: "#94A3B8",
          muted: "#64748B",
        },
      },
      fontFamily: {
        display: ["Rajdhani", "sans-serif"],
        body: ["Roboto", "sans-serif"],
      },
      fontSize: {
        "score": ["4rem", { lineHeight: "1", fontWeight: "700" }],
        "score-sm": ["2.5rem", { lineHeight: "1", fontWeight: "700" }],
      },
      borderRadius: {
        "xl": "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        "card": "0 4px 24px rgba(0,0,0,0.4)",
        "glow": "0 0 20px rgba(29,78,216,0.4)",
        "glow-green": "0 0 20px rgba(34,197,94,0.5)",
      },
      animation: {
        "pulse-slow": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-in": "bounceIn 0.5s ease-out",
        "fade-in": "fadeIn 0.3s ease-in",
        "slide-up": "slideUp 0.3s ease-out",
        "shimmer": "shimmer 1.5s infinite",
      },
      keyframes: {
        bounceIn: {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "70%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      minHeight: {
        "tap": "44px",
        "tap-lg": "56px",
      },
    },
  },
  plugins: [],
};

export default config;
