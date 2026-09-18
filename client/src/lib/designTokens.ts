export const trustPathTokens = {
  colors: {
    background: "#071A2B",
    surface: "#0D2638",
    elevated: "#12344A",
    teal: "#16B8A6",
    tealHover: "#27D6C2",
    amber: "#F4B740",
    verified: "#36C275",
    challenge: "#F05D5E",
    info: "#56A8FF",
    text: "#F5F8FA",
    secondaryText: "#A9BBC7",
    border: "#29485A",
  },
  fonts: {
    body: "Inter, ui-sans-serif, system-ui, sans-serif",
    heading: "Space Grotesk, Inter, ui-sans-serif, system-ui, sans-serif",
    mono: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace",
  },
} as const;

export type TrustPathStatus = "verified" | "challenge" | "warning" | "info" | "unknown";
