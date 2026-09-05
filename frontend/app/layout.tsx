import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { LanguageProvider } from "@/context/language-context";
import { SidebarProvider } from "@/context/sidebar-context";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "MachFixAI - Industrial Diagnostic Platform",
  description:
    "AI-powered machine troubleshooting and diagnostic platform with RAG-based source citations from service manuals",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/logo.png", sizes: "1024x1024", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[var(--color-bg)] text-[var(--color-text)] antialiased">
        <ThemeProvider>
          <LanguageProvider>
            <SidebarProvider>
              <AppShell>{children}</AppShell>
            </SidebarProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
