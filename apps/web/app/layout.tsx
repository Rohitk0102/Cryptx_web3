import type { Metadata } from "next";
import {
  ClerkProvider,
} from "@clerk/nextjs";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-context";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CryptX - Crypto Portfolio Tracker",
  description: "Track your crypto portfolio across multiple chains and wallets — institutional-grade tools for elite traders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${dmSans.variable} antialiased bg-[#08070E] text-[#F5F5F5]`}
          suppressHydrationWarning
        >
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
