import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TableTrace",
  description: "Hospitality booking agent with alignment dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100 min-h-screen`}
      >
        <nav className="border-b border-zinc-800/60 px-6 h-12 flex items-center justify-between sticky top-0 z-50 bg-zinc-950/80 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-indigo-500 flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="3" fill="white" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
              TableTrace
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Link
              href="/book"
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800 transition-colors"
            >
              Book
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
