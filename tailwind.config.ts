import type { Config } from "tailwindcss";

// Design system tokens for the Hotel Management System.
// Sophisticated neutral base + one strong hospitality accent (deep teal/emerald),
// per the product's visual direction. Keep all screens referencing these tokens
// instead of raw hex values so the whole app stays visually consistent.

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral base
        bg: "#FAF9F6",           // warm off-white app background
        surface: "#FFFFFF",       // cards
        border: "#E7E5E0",
        text: {
          primary: "#1F2421",     // deep charcoal
          secondary: "#6B7268",   // muted gray
          muted: "#9CA39B",
        },
        // Primary accent — deep teal/emerald
        primary: {
          50: "#EAF3F0",
          100: "#CFE4DC",
          300: "#7FB5A3",
          500: "#1F6F5C",
          600: "#175A4A",
          700: "#124639",
        },
        // Secondary accent — warm champagne
        champagne: {
          50: "#FBF6EC",
          200: "#EBDCB8",
          500: "#C9A24B",
        },
        success: "#2E7D46",
        warning: "#B8860B",
        danger: "#B3261E",
        info: "#2563A8",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        control: "8px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(31, 36, 33, 0.04), 0 2px 8px rgba(31, 36, 33, 0.06)",
        popover: "0 4px 16px rgba(31, 36, 33, 0.12)",
      },
      spacing: {
        // 8px base spacing system
        4.5: "1.125rem",
      },
    },
  },
  plugins: [],
};

export default config;
