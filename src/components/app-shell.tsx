"use client";

import * as React from "react";
import TecxpShell from "@/components/tecxp-shell";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <TecxpShell>{children}</TecxpShell>;
}
