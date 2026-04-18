"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  Type,
  Scissors,
  Image as ImageIcon,
  Link2,
  Tag,
  Wand2,
  Split,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TecxpShellProps = {
  children: React.ReactNode;
};

const mainTools = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/converter_srt", label: "Conversor SRT", icon: FileText },
  { href: "/contadorcaracteres", label: "Contador de Caracteres", icon: Type },
  { href: "/analysis_script", label: "Divisor de Texto", icon: Scissors },
  { href: "/check_videos", label: "Extrator de Frame", icon: ImageIcon },
  { href: "/linkinscricao", label: "Link de Inscricao", icon: Link2 },
  { href: "/translate", label: "Extrator de Tags", icon: Tag },
  { href: "/separador-prompts", label: "Separador de Prompts", icon: Split },
];

const secondaryTools = [
  { href: "/upscaleimage", label: "Upscale de Imagem", icon: Wand2 },
];

export default function TecxpShell({ children }: TecxpShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full">
        <aside className="hidden lg:flex w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">T</div>
            <span className="font-semibold">TecXP</span>
            <span className="ml-auto text-xs text-muted-foreground">PT</span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <p className="mb-2 px-2 text-[11px] uppercase tracking-wider text-muted-foreground">Ferramentas para Youtube</p>
            <nav className="space-y-1">
              {mainTools.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={pathname === item.href}
                />
              ))}
            </nav>

            <p className="mb-2 mt-6 px-2 text-[11px] uppercase tracking-wider text-muted-foreground">Outras ferramentas</p>
            <nav className="space-y-1">
              {secondaryTools.map((item) => (
                <SidebarLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={pathname === item.href}
                />
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex-1">
          <main className="mx-auto w-full max-w-[1080px] px-4 py-6 md:px-8 md:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm transition-colors",
        active
          ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}
