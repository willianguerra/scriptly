"use client";

import * as React from "react";
import type { SessionRole } from "@/lib/auth/session";

export type UsuarioAtual = {
  username: string;
  role: SessionRole;
};

const UserContext = React.createContext<UsuarioAtual | null>(null);

export function UserProvider({
  value,
  children,
}: {
  value: UsuarioAtual;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/** Dados do usuário logado, disponíveis em qualquer componente cliente da área
 * autenticada. Lança se usado fora do UserProvider. */
export function useUsuarioAtual(): UsuarioAtual {
  const ctx = React.useContext(UserContext);
  if (!ctx) {
    throw new Error("useUsuarioAtual deve ser usado dentro de UserProvider.");
  }
  return ctx;
}
