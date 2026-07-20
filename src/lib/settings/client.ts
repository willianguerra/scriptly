// Cliente (browser) das preferências do usuário via /api/settings.

import type { ProviderRoteiro } from "@/lib/roteiro/types";

export interface Configuracoes {
  defaultProvider: ProviderRoteiro | null;
}

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error || `Erro ${res.status}`;
}

export async function obterConfiguracoes(): Promise<Configuracoes> {
  const res = await fetch("/api/settings", { cache: "no-store" });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return { defaultProvider: data?.defaultProvider ?? null };
}

export async function salvarModeloPadrao(
  defaultProvider: ProviderRoteiro | null
): Promise<void> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ defaultProvider }),
  });
  if (!res.ok) throw new Error(await readError(res));
}
