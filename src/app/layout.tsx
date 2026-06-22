import type { Metadata } from "next";
import "./globals.css";
import { ThemeToggle } from "./theme-toggle";
import { Analytics } from "@vercel/analytics/next";

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
        className="min-h-full flex flex-col bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_34%),linear-gradient(180deg,_#eef6ff_0%,_#ffffff_100%)] text-[#003d73] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] dark:text-slate-100"
      >
        <ThemeToggle />
        {children}
        <Analytics />
      </body>
    </html>
  );
}

