"use client";

import React from "react";
import { Image as ImageIcon, Menu, FileText, Brain, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { ThemeToggleButton } from "./theme-toggle-button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { motion } from "framer-motion";

export const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-border bg-background">
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <ImageIcon className="h-6 w-6 text-foreground" />
          <span className="text-lg font-semibold text-foreground">Scriptly</span>
        </Link>

        {/* Links Desktop */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-foreground hover:text-primary transition"
          >
            Início
          </Link>
          <Link
            href="/converter_srt"
            className="text-sm font-medium text-foreground hover:text-primary transition"
          >
            Conversor SRT
          </Link>
          <Link
            href="/analysis_script"
            className="text-sm font-medium text-foreground hover:text-primary transition"
          >
            Análise Roteiros
          </Link>
          <ThemeToggleButton />
        </div>

        {/* Menu Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggleButton />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>

            <SheetContent
              side="right"
              className="flex flex-col space-y-4 pt-6 overflow-hidden"
            >
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex flex-col h-full"
              >
                <SheetHeader className="mb-4">
                  <SheetTitle className="text-lg font-semibold">
                    Menu Principal
                  </SheetTitle>
                  <SheetDescription className="text-sm text-muted-foreground">
                    Acesse as ferramentas disponíveis
                  </SheetDescription>
                </SheetHeader>

                <nav className="flex flex-col gap-2 mt-2">
                  <Link href="/">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-base font-medium hover:bg-accent hover:text-accent-foreground gap-2"
                    >
                      <Home className="w-5 h-5" />
                      Início
                    </Button>
                  </Link>

                  <Link href="/converter_srt">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-base font-medium hover:bg-accent hover:text-accent-foreground gap-2"
                    >
                      <FileText className="w-5 h-5" />
                      Conversor SRT
                    </Button>
                  </Link>

                  <Link href="/analysis_script">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-base font-medium hover:bg-accent hover:text-accent-foreground gap-2"
                    >
                      <Brain className="w-5 h-5" />
                      Análise de Roteiros
                    </Button>
                  </Link>
                </nav>

                <Separator className="my-4" />

                <div className="mt-auto flex flex-col items-center gap-1 text-sm text-muted-foreground pb-2">
                  <span>🌟 Ferramentas criadas com ❤️ - warlittle</span>
                  <span>© {new Date().getFullYear()} Scriptly</span>
                </div>
              </motion.div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Separator className="w-full bg-border" />
    </header>
  );
};

export default Header;
