"use client";

import * as React from "react";
import ScriptlyShell from "@/components/scriptly-shell";
import { UserProvider } from "@/components/user-context";
import type { SessionRole } from "@/lib/auth/session";

export default function AppShell({
  children,
  username,
  role,
}: {
  children: React.ReactNode;
  username: string;
  role: SessionRole;
}) {
  return (
    <UserProvider value={{ username, role }}>
      <ScriptlyShell username={username} role={role}>
        {children}
      </ScriptlyShell>
    </UserProvider>
  );
}
