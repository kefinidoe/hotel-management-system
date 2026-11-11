import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral base
        bg: "#FAF9F6",           // warm ivory / soft off-white
        surface: "#FFFFFF",       // cards
        border: "#EAE9E4",
        text: {
          primary: "#1A1D1A",     // deep charcoal
          secondary: "#5E635E",   // muted olive-gray
          muted: "#949994",
        },
        // Brand Identity
        navy: {
          50: "#E6E6EC",
          100: "#CECDD9",
          200: "#9D9BB3",
          300: "#6B698D",
          400: "#3A3767",
          500: "#0B0244", // Axis Navy
          600: "#09023D",
          700: "#080235",
          800: "#06012E",
          900: "#050126",
        },
        gold: {
          50: "#FBF4E4",
          100: "#F7E9C9",
          200: "#EFD393",
          300: "#E7BD5D",
          400: "#DFA727",
          500: "#DB921F", // Axis Gold
          600: "#AF7C1A",
          700: "#835D14",
          800: "#57420E",
          900: "#2B2107",
        },
        teal: {
          50: "#E3F2F3",
          100: "#B9DFE1",
          200: "#8CCACD",
          300: "#5EB5B9",
          400: "#3CA6AA",
          500: "#1C989E", // Interactive Teal
          600: "#198A91",
          700: "#157A81",
          800: "#116A71",
          900: "#0A4E55",
        },
        // Functional Colors
        success: {
          DEFAULT: "#15803D",
          bg: "#DCFCE7",
          text: "#14532D",
        },
        warning: {
          DEFAULT: "#B45309",
          bg: "#FEF3C7",
          text: "#78350F",
        },
        danger: {
          DEFAULT: "#B91C1C",
          bg: "#FEE2E2",
          text: "#7F1D1D",
        },
        info: {
          DEFAULT: "#0369A1",
          bg: "#E0F2FE",
          text: "#0C4A6E",
        },
        // Sidebar specifically
        sidebar: {
          bg: "#0B0244", // Deep Navy
          hover: "#150D5C",
          active: "#1C989E", // Teal
          text: "#FFFFFF",
          textMuted: "rgba(255, 255, 255, 0.65)",
          border: "rgba(255, 255, 255, 0.1)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Calibri", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        control: "10px",
        pill: "100px",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        card: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
        "card-hover": "0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
        popover: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
