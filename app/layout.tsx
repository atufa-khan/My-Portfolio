import type { Metadata } from "next";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/dm-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atufa Khan — The Wayfinder",
  description:
    "Portfolio of Atufa Khan: AI/ML engineer and researcher building LLM agents, evaluation pipelines and healthcare AI. B.Tech CSE (AI & ML), Sharda University.",
  openGraph: {
    title: "Atufa Khan — The Wayfinder",
    description: "LLM agents, evaluation pipelines and healthcare AI.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
