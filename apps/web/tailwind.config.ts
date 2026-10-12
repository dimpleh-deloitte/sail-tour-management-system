import type { Config } from "tailwindcss";

// SAIL blue / steel-gray palette, ported from the legacy prototype's
// DESIGN_SYSTEM.md (kept because it's the approved visual language — see
// Phase1_Inspection_and_Implementation_Plan.md §2).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sail: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#1e56a0",
          600: "#194a8a",
          700: "#123a6e",
          900: "#0a2240",
        },
        steel: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          800: "#1e293b",
          900: "#0f172a",
        },
        status: {
          pending: "#f59e0b",
          approved: "#10b981",
          rejected: "#ef4444",
          draft: "#64748b",
        },
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.04)",
        "card-hover": "0 4px 12px rgba(15, 23, 42, 0.06), 0 12px 32px rgba(30, 86, 160, 0.08)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        shimmer: "shimmer 2s infinite linear",
      },
    },
  },
  plugins: [],
} satisfies Config;
