import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Marca do Scriptly: um quadrado arredondado com gradiente, um "play" (vídeo) e
 * uma linha de legenda/roteiro abaixo — vídeo + roteiro, a essência da plataforma.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="Scriptly"
      className={cn("h-8 w-8", className)}
    >
      <defs>
        <linearGradient id="scriptly-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#scriptly-grad)" />
      <path
        d="M16 12.8 L27.5 19.1 a1 1 0 0 1 0 1.75 L16 27.2 a1 1 0 0 1-1.5-.87 V13.67 A1 1 0 0 1 16 12.8 Z"
        fill="#ffffff"
      />
      <rect
        x="12.5"
        y="29.6"
        width="15"
        height="2.6"
        rx="1.3"
        fill="#ffffff"
        opacity="0.85"
      />
    </svg>
  );
}

/** Marca + wordmark "Scriptly". */
export function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="text-base font-semibold tracking-tight">Scriptly</span>
    </span>
  );
}
