import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7ff",
          100: "#deedff",
          500: "#1f6feb",
          700: "#1255b8"
        }
      }
    }
  },
  plugins: []
} satisfies Config;

