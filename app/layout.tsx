import "./globals.css";
import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { AdminAuthProvider } from "@/components/auth/AdminAuthProvider";
import { Toaster } from "@/components/ui/sonner";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FinalsPrep Admin",
  description: "Internal admin system for FinalsPrep",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}>
        <AdminAuthProvider>{children}</AdminAuthProvider>
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
