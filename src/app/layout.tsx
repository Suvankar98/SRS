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
  const currentUserName = session ? await getCurrentUserName(session.userId) : null;

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
                  name: currentUserName ?? "User",
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

async function getCurrentUserName(userId: string) {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    return currentUser?.name ?? null;
  } catch (error) {
    console.error("Failed to load current user for app shell", error);
    return null;
  }
}
