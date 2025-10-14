import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastContainer } from 'react-toastify';
import { ThemeProvider } from "next-themes";

import "./globals.css";
import Header from "@/components/header";
import Footer from "@/components/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Next.js Sisp Test",
    template: "%s | Next.js Sisp Test",
  },
  description:
    "A reusable Sisp Test component for Next.js with TypeScript, Tailwind CSS, and react-hook-form. Upload, preview, and delete images with ease.",
  keywords: [
    "Next.js",
    "Sisp Test",
    "TypeScript",
    "Tailwind CSS",
    "react-hook-form",
    "shadcn/ui",
    "image upload",
  ],
  authors: [{ name: "willianguerra", url: "https://github.com/willianguerra" }],
  creator: "willianguerra",
  publisher: "willianguerra",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Next.js Sisp Test",
    description:
      "Easily upload multiple images with a responsive, type-safe component built for Next.js.",
    url: "https://github.com/willianguerra/converter",
    siteName: "Next.js Sisp Test",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Next.js Sisp Test Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Next.js Sisp Test",
    description:
      "A reusable Sisp Test component for Next.js with TypeScript and Tailwind CSS.",
    creator: "@jacksonkasi11",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}