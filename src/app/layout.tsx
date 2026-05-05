import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Tokenly — Make every token count",
  description:
    "Tokenly compresses your prompts, visualizes token waste, and shows real cost across every major LLM. Cut your AI bill by 40%+ without losing intent.",
  applicationName: "Tokenly",
  authors: [{ name: "Tokenly" }],
  openGraph: {
    title: "Tokenly — Make every token count",
    description:
      "Compress prompts, visualize waste, compare model cost. Stop paying for tokens that don't matter.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded focus:bg-neon focus:text-deep focus:font-medium"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
