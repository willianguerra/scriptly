// Cliente (browser) para gerar roteiros via /api/roteiro.
// Espelha o padrão da Darkvi (darkvi.ts): a chave de cada LLM é guardada no
// localStorage (definida nas Configurações) e enviada por header. Sem chave
// salva, o servidor cai no fallback da variável de ambiente.

import type {
  EntradaRoteiro,
  ProviderRoteiro,
  ResultadoRoteiro,
} from "@/lib/roteiro/types";

/** Chaves do localStorage por provider. */
const STORAGE_KEYS: Record<Exclude<ProviderRoteiro, "fake">, string> = {
  gemini: "roteiro-gemini-key",
  openai: "roteiro-openai-key",
};

/** Header por provider (deve casar com provider-server.ts). */
const HEADER_KEYS: Record<Exclude<ProviderRoteiro, "fake">, string> = {
  gemini: "x-gemini-key",
  openai: "x-openai-key",
};

export function getChave(provider: Exclude<ProviderRoteiro, "fake">): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEYS[provider]) ?? "";
}

export function setChave(
  provider: Exclude<ProviderRoteiro, "fake">,
  chave: string
) {
  if (typeof window === "undefined") return;
  const limpa = chave.trim();
  if (limpa) localStorage.setItem(STORAGE_KEYS[provider], limpa);
  else localStorage.removeItem(STORAGE_KEYS[provider]);
}

export function temChave(provider: Exclude<ProviderRoteiro, "fake">): boolean {
  return getChave(provider).length > 0;
}

function authHeaders(provider: ProviderRoteiro): HeadersInit {
  if (provider === "fake") return {};
  const chave = getChave(provider).trim();
  return chave ? { [HEADER_KEYS[provider]]: chave } : {};
}

export interface GerarRoteiroParams extends EntradaRoteiro {
  provider: ProviderRoteiro;
  modelo?: string;
}

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.message || data?.code || `Erro ${res.status}`;
}

export async function gerarRoteiro(
  params: GerarRoteiroParams
): Promise<ResultadoRoteiro> {
  const { provider, modelo, ...entrada } = params;
  const res = await fetch("/api/roteiro", {
    method: "POST",
    headers: {
      ...authHeaders(provider),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ provider, modelo, ...entrada }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return {
    texto: data.texto,
    provider: data.provider,
    modelo: data.modelo,
  };
}
