import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import { AppShell } from "./app-shell";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-app",
});

export const metadata: Metadata = {
  title: "SRS Service Desk",
  description: "SRS Service Desk for managing service requests, employee assignments, and status updates with WhatsApp notifications.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const currentUser = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true },
      })
    : null;

  return (
    <html lang="en" className={`h-full bg-[#eef6ff] antialiased ${nunitoSans.variable}`}>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_34%),linear-gradient(180deg,_#eef6ff_0%,_#ffffff_100%)] text-[#003d73]"
      >
        <AppShell
          user={
            session
              ? {
                  name: currentUser?.name ?? "User",
                  role: session.role,
                }
              : null
          }
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
