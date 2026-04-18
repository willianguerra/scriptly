import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";

import "./globals.css";
import AppShell from "@/components/app-shell";

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
    default: "Scriptly",
    template: "%s | Scriptly",
  },
  description:
    "Scriptly é uma plataforma prática e intuitiva para criar, editar e converter roteiros em legendas (SRT), além de gerar arquivos TXT organizados — tudo com suporte responsivo e rápido.",
  keywords: [
    "Scriptly",
    "Conversor SRT",
    "Análise de roteiros",
    "Legenda automática",
    "Next.js",
    "TypeScript",
    "Tailwind CSS",
    "shadcn/ui",
    "Roteiro",
    "Subtitles",
    "Video tools",
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
    title: "Scriptly",
    description:
      "Crie, edite e converta roteiros em legendas SRT ou arquivos TXT de forma simples, rápida e organizada com o Scriptly.",
    url: "https://github.com/willianguerra/converter",
    siteName: "Scriptly",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Scriptly Preview",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Scriptly",
    description:
      "Crie e converta roteiros em legendas SRT e arquivos TXT com facilidade — Scriptly.",
    creator: "@willianguerra",
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
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
