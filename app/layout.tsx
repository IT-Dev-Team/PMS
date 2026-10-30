import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider ";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "EIH PMS · Ethiopian Investment Holding",
  description:
    "AI-powered project management platform for Ethiopian Investment Holding",
  keywords: "Ethiopian Investment Holding, EIH, Project Management, Portfolio",
  authors: [{ name: "EIH Team" }],
  icons: { icon: "/eih.png", shortcut: "/eih.png", apple: "/eih.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1B3B34" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1b17" },
  ],
};

const THEME_INIT = `(function(){try{var t=localStorage.getItem('eih-theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light'}catch(_){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body
        className={`${inter.variable} font-sans bg-background text-foreground antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
