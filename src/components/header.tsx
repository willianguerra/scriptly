"use client";

import React from "react";
import { Github, Sun, Moon, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import Link from "next/link";
import { ThemeToggleButton } from "./theme-toggle-button";

export const Header: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="w-full">
      <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href={'/'} className="flex items-center gap-2">
          <ImageIcon className="h-6 w-6 text-foreground" />
          {/* <span className="text-lg font-semibold text-foreground">Video Converter</span> */}
          <span className="text-lg font-semibold text-foreground">Uploader</span>
        </Link>

        {/* GitHub Link & Theme Toggle */}

        <div className="flex items-center gap-4">
          <Link href="converter_srt">Conversor SRT</Link>
          <Link href="analysis_script">Análise Roteiros</Link>
          <ThemeToggleButton />
        </div>
      </div>
      {/* Divider */}
      <Separator className="w-full bg-border" />
    </header>
  );
};

export default Header;