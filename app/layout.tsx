import type { Metadata } from "next";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/dm-sans";
import "@fontsource/caveat/500.css";
import "@fontsource/caveat/600.css";
import "./globals.css";

// Absolute links for the share image: set NEXT_PUBLIC_SITE_URL in Vercel once the custom domain is connected.
const site =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "Atufa Khan — Software Engineer",
  description:
    "Portfolio of Atufa Khan: software engineer building LLM agents, evaluation pipelines and healthcare AI. B.Tech CSE (AI & ML), Sharda University.",
  openGraph: {
    title: "Atufa Khan — Software Engineer",
    description: "LLM agents, evaluation pipelines and healthcare AI. A portfolio you sail through.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
