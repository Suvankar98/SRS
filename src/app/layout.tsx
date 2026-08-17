import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import { AppShell } from "./app-shell";
import { ThemeToggle } from "./theme-toggle";
import { getSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-app",
});

export const metadata: Metadata = {
  title: "SRTEC Service Desk",
  description: "SRTEC Service Desk for managing service requests, employee assignments, and status updates with WhatsApp notifications.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const currentUserName = session ? await getCurrentUserName(session.userId) : null;

  return (
    <html lang="en" suppressHydrationWarning className={`h-full bg-[#eef6ff] antialiased ${nunitoSans.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var storedTheme = localStorage.getItem("srs-theme");
                var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                var theme = storedTheme || (prefersDark ? "dark" : "light");
                document.documentElement.classList.toggle("dark", theme === "dark");
                document.documentElement.dataset.theme = theme;
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_34%),linear-gradient(180deg,_#eef6ff_0%,_#ffffff_100%)] text-[#003d73]"
      >
        <ThemeToggle />
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
    if (isDatabaseConnectionError(error)) {
      console.warn("Database is temporarily unreachable while loading the app shell user name.");
      return null;
    }

    console.error("Failed to load current user for app shell");
    return null;
  }
}

function isDatabaseConnectionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001";
}
