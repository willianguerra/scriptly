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
  AudioLines,
  Menu,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

type ScriptlyShellProps = {
  children: React.ReactNode;
};

type ToolItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const mainTools: ToolItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/divisor-audio", label: "Divisor de Áudio", icon: AudioLines },
  { href: "/upscaleimage", label: "Thumbnail YouTube", icon: Wand2 },
  { href: "/check_videos", label: "Contador de Videos", icon: ImageIcon },
  { href: "/separador-prompts", label: "Separador de Prompts", icon: Split },
  { href: "/linkinscricao", label: "Link de Inscricao", icon: Link2 },
  { href: "/contadorcaracteres", label: "Contador de Caracteres", icon: Type },
  { href: "/converter_srt", label: "Conversor SRT", icon: FileText },
  { href: "/analysis_script", label: "Divisor de Texto", icon: Scissors },
  { href: "/translate", label: "Extrator de Tags", icon: Tag },
];

const secondaryTools: ToolItem[] = [];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent-foreground text-primary-foreground font-bold text-sm shadow-sm">
        S
      </div>
      <span className="text-base font-semibold tracking-tight">Scriptly</span>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Ferramentas para Youtube
      </p>
      <nav className="space-y-1">
        {mainTools.map((item) => (
          <SidebarLink
            key={item.href}
            {...item}
            active={pathname === item.href}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {secondaryTools.length > 0 ? (
        <>
          <p className="mb-2 mt-6 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Outras ferramentas
          </p>
          <nav className="space-y-1">
            {secondaryTools.map((item) => (
              <SidebarLink
                key={item.href}
                {...item}
                active={pathname === item.href}
                onNavigate={onNavigate}
              />
            ))}
          </nav>
        </>
      ) : null}
    </>
  );
}

export default function ScriptlyShell({ children }: ScriptlyShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const activeTool = [...mainTools, ...secondaryTools].find(
    (item) => item.href === pathname
  );

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen w-full">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur supports-[backdrop-filter]:bg-sidebar/60 text-sidebar-foreground lg:flex">
          <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
            <Brand />
            <span className="ml-auto rounded-md border border-sidebar-border bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium text-sidebar-accent-foreground">
              PT
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav />
          </div>

          <div className="border-t border-sidebar-border p-3">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2">
              <span className="text-xs text-muted-foreground">Tema</span>
              <ThemeToggleButton />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden">
            <Brand />
            <div className="flex items-center gap-1">
              <ThemeToggleButton />
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Abrir menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0">
                  <SheetHeader className="border-b border-border px-4 py-4 text-left">
                    <SheetTitle>
                      <Brand />
                    </SheetTitle>
                    <SheetDescription>Acesse as ferramentas disponiveis</SheetDescription>
                  </SheetHeader>
                  <div className="overflow-y-auto px-3 py-4">
                    <SidebarNav onNavigate={() => setMobileOpen(false)} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1080px] px-4 py-6 md:px-8 md:py-10">
            {activeTool && activeTool.href !== "/" && (
              <nav
                aria-label="Breadcrumb"
                className="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Link href="/" className="transition-colors hover:text-foreground">
                  Scriptly
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{activeTool.label}</span>
              </nav>
            )}
            {children}
          </main>
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
  onNavigate,
}: ToolItem & {
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-opacity",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
