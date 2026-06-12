import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#111827",
          800: "#1f2937",
          600: "#4b5563",
          500: "#6b7280"
        },
        line: "#d9dee7",
        surface: "#f6f8fb",
        brand: {
          700: "#0f766e",
          600: "#0d9488",
          500: "#14b8a6"
        },
        coral: {
          500: "#f9735b"
        },
        amber: {
          500: "#f5a524"
        }
      },
      boxShadow: {
        panel: "0 12px 30px rgba(17, 24, 39, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
