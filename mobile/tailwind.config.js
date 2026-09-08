/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // "class" (not the Tailwind/NativeWind default "media") - something in
  // the Expo Router/React Navigation boot sequence calls NativeWind's own
  // colorScheme.set() at startup (not app code - confirmed nothing in src/
  // calls it), which NativeWind refuses outright under "media" mode
  // (nativewind/dist/stylesheet.js: "Unable to manually set color scheme
  // without using darkMode: class"). That crashed the app immediately on
  // web (discovered running `expo start --web` for the first time - Android/
  // iOS apparently don't hit the same guard). Dark mode itself is still
  // deferred to its own phase (see the color tokens below, light-only for
  // now) - this only lets that automatic call succeed silently instead of
  // throwing; no dark: classes exist yet for it to actually apply.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Same token names as the web app's globals.css (src/app/globals.css),
        // light-mode values only for now - dark mode comes back in Phase 4
        // alongside the settings screen, same as the web build's own order.
        background: "#f8fafc",
        surface: "#ffffff",
        foreground: "#1a202c",
        muted: "#64748b",
        faint: "#94a3b8",
        border: "#e2e8f0",
        accent: {
          50: "#eef2ff",
          500: "#4f46e5",
          600: "#4338ca",
          700: "#3730a3",
        },
        "brand-blue": { 50: "#eff6ff", 500: "#3b82f6", 600: "#2563eb" },
        "brand-red": { 50: "#fef2f2", 500: "#dc3545", 600: "#b02a37" },
        teal: { 50: "#effcf9", 500: "#0e857b", 600: "#0e857b" },
        orange: { 50: "#fffbeb", 500: "#d97706", 600: "#d97706" },
        green: { 50: "#ecfdf5", 500: "#15803d", 600: "#15803d" },
        purple: { 50: "#faf5ff", 500: "#9333ea", 600: "#9333ea" },
        pink: { 50: "#fdf2f8", 500: "#db2777", 600: "#db2777" },
      },
    },
  },
  plugins: [],
};
