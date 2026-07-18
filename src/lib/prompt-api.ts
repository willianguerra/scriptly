// Cliente (browser) da biblioteca de prompts, agora persistida no banco via
// /api/prompts. Substitui o antigo prompt-store (localStorage).

import type { PromptSalvo } from "@/types/prompt";

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error || `Erro ${res.status}`;
}

export async function listarPrompts(): Promise<PromptSalvo[]> {
  const res = await fetch("/api/prompts");
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return Array.isArray(data) ? (data as PromptSalvo[]) : [];
}

export async function criarPrompt(dados: {
  nome: string;
  texto: string;
}): Promise<PromptSalvo> {
  const res = await fetch("/api/prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function atualizarPrompt(
  id: string,
  dados: { nome?: string; texto?: string }
): Promise<PromptSalvo> {
  const res = await fetch(`/api/prompts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function excluirPrompt(id: string): Promise<void> {
  const res = await fetch(`/api/prompts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res));
}
