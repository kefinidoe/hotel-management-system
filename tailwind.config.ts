import type { Config } from "tailwindcss";

// Design system tokens for the Hotel Management System.
// Brand: Axis Hotel Nakuru — deep navy + gold, per the hotel's actual logo.
// The sidebar nav uses its own `sidebar` scale (matched to a reference
// screenshot: dark navy-charcoal bg + teal active state) rather than
// reusing primary/champagne. Keep all screens referencing these tokens
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
        // Primary accent — Axis navy (from logo, exact hex #0B0244)
        primary: {
          50: "#ECEBF0",
          100: "#CECCDA",
          300: "#918DAB",
          500: "#0B0244",
          600: "#0A023D",
          700: "#090236",
        },
        // Secondary accent — Axis gold (from logo, exact hex #DB921F)
        champagne: {
          50: "#FAEFDD",
          200: "#EFCE9A",
          500: "#DB921F",
          600: "#BA7C1A",
        },
        // Dark sidebar panel — colors matched exactly from reference screenshot
        sidebar: {
          bg: "#182533",
          hover: "#22384A",      // derived by lightening bg — no hover state was visible to sample directly
          active: "#1C989E",
          text: "#F2F6F9",
          textMuted: "rgba(242, 246, 249, 0.6)",
          border: "rgba(242, 246, 249, 0.08)",
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
        4.5: "1.125rem",
      },
    },
  },
  plugins: [],
};

export default config;