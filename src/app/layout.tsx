import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";

import "./globals.css";
import AppShell from "@/components/app-shell";
import { LoginScreen } from "@/components/auth/login-screen";
import { getServerSession } from "@/lib/auth/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
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
    url: "/",
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
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
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


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession();

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {session ? (
            <AppShell username={session.username}>{children}</AppShell>
          ) : (
            <LoginScreen />
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
