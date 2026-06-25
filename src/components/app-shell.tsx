"use client";

import * as React from "react";
import ScriptlyShell from "@/components/scriptly-shell";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <ScriptlyShell>{children}</ScriptlyShell>;
}
