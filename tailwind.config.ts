import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-noto)", "var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "var(--font-noto)", "system-ui", "sans-serif"],
      },
      colors: {
        /** Warm app canvas (behind white cards) */
        canvas: {
          DEFAULT: "#FAFAF9",
          muted: "#F5F5F4",
        },
        /** Interactive / UI accent — neutral, not marketing blue */
        brand: {
          DEFAULT: "#52525B",
          soft: "#F4F4F5",
          strong: "#18181B",
          muted: "#A1A1AA",
        },
        surface: {
          DEFAULT: "#F5F5F4",
          card: "#FFFFFF",
          border: "#E7E5E4",
        },
        ink: {
          DEFAULT: "#171717",
          secondary: "#737373",
        },
      },
      boxShadow: {
        card: "0 1px 0 rgba(0, 0, 0, 0.04)",
        soft: "0 1px 2px rgba(0, 0, 0, 0.04)",
      },
      backgroundImage: {
        "page-gradient": "linear-gradient(180deg, #FAFAF9 0%, #FAFAF9 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
