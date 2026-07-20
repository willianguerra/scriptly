// Cliente (browser) dos canais, persistidos via /api/channels.
// Espelha o padrão de src/lib/prompt-api.ts.

import type { CanalSalvo } from "@/types/channel";

export interface DadosCanal {
  nome: string;
  handle?: string | null;
  descricao?: string | null;
  nicho?: string | null;
  idioma?: string | null;
  promptSistemaPadrao?: string | null;
  defaultPromptId?: string | null;
}

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error || `Erro ${res.status}`;
}

export async function listarCanais(): Promise<CanalSalvo[]> {
  const res = await fetch("/api/channels");
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return Array.isArray(data) ? (data as CanalSalvo[]) : [];
}

export async function obterCanal(id: string): Promise<CanalSalvo> {
  const res = await fetch(`/api/channels/${id}`);
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function criarCanal(dados: DadosCanal): Promise<CanalSalvo> {
  const res = await fetch("/api/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function atualizarCanal(
  id: string,
  dados: Partial<DadosCanal>
): Promise<CanalSalvo> {
  const res = await fetch(`/api/channels/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function excluirCanal(id: string): Promise<void> {
  const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res));
}
