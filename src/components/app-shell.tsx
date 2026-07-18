"use client";

import * as React from "react";
import ScriptlyShell from "@/components/scriptly-shell";

export default function AppShell({
  children,
  username,
}: {
  children: React.ReactNode;
  username: string;
}) {
  return <ScriptlyShell username={username}>{children}</ScriptlyShell>;
}
