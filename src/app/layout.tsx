import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SRS Service Desk",
  description: "Service request form with SQLite-backed dashboard and docket numbers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-[#eef6ff] antialiased">
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_34%),linear-gradient(180deg,_#eef6ff_0%,_#ffffff_100%)] text-[#003d73]"
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

