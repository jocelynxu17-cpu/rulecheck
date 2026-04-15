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
        brand: {
          DEFAULT: "#4F8CFF",
          soft: "#E8F1FF",
          strong: "#3B7AE8",
          muted: "#7BA8FF",
        },
        surface: {
          DEFAULT: "#F5F9FF",
          card: "#FFFFFF",
          border: "#E6EEF8",
        },
        ink: {
          DEFAULT: "#1A1A1A",
          secondary: "#6B7280",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)",
        soft: "0 12px 40px rgba(79, 140, 255, 0.12)",
      },
      backgroundImage: {
        "page-gradient": "linear-gradient(180deg, #F5F9FF 0%, #FFFFFF 42%, #F8FAFF 100%)",
        "btn-primary": "linear-gradient(135deg, #9EC5FF 0%, #4F8CFF 48%, #3B7AE8 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
