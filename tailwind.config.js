/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        paper: "#f8fafc",
        line: "#e2e8f0",
        body: "#334155",
        mute: "#64748b",
        panel: "#ffffff",
        accent: "#ea580c",
        accentSoft: "#ffedd5",
        positive: "#059669",
        positiveSoft: "#d1fae5",
        warning: "#ca8a04",
        warningSoft: "#fef9c3",
        danger: "#dc2626",
        dangerSoft: "#fee2e2"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["Georgia", "ui-serif", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
      },
      boxShadow: {
        panel: "0 10px 30px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: [],
};
