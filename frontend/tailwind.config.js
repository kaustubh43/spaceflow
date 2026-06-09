/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        // dark-mode surface ramp: blue-rich navy (not near-black slate) with
        // clear value steps between bg → surface → raised → border for depth.
        navy: {
          950: "#0a1122", // app background (deep navy)
          900: "#141f3a", // panels / surfaces (clearly lifted off the bg)
          850: "#1b2747",
          800: "#22305a", // raised elements: inputs, buttons, overlays
          700: "#2e3e69", // borders / hover
          600: "#3e5184",
          500: "#5167a0",
          400: "#8290b6",
          300: "#a9b4d2",
          200: "#cbd3e6",
          100: "#e5e9f3",
        },
        ink: {
          50: "#f8fafc",
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
          200: "#e2e8f0",
          100: "#f1f5f9",
        },
      },
    },
  },
  plugins: [],
};
