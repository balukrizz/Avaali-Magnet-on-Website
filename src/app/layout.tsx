import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Avaali Solutions — Enterprise AI Opportunity Assessment",
  description: "Configurable AI readiness assessment platform with a rule engine and provider-agnostic LLM recommendations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="aura" />
        {children}
      </body>
    </html>
  );
}
