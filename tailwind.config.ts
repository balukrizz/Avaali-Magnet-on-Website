import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0E1A", panel: "#111827", line: "#233048",
        accent: "#5B6EF5", accent2: "#7C5BF5",
        amber: "#F2B441", mint: "#34D3A6", rose: "#F26D8C",
        muted: "#9AA7C4", faint: "#66739B",
      },
      fontFamily: { display: ["Sora", "sans-serif"], mono: ["JetBrains Mono", "monospace"] },
    },
  },
  plugins: [],
};
export default config;
