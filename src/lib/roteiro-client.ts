// Cliente (browser) para gerar roteiros via /api/roteiro.
// A chave de cada LLM NÃO trafega mais pelo cliente: o servidor usa a chave do
// usuário logado (guardada criptografada no banco), gerenciada em Configurações.

import type {
  EntradaRoteiro,
  ProviderRoteiro,
  ResultadoRoteiro,
} from "@/lib/roteiro/types";

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
    headers: { "Content-Type": "application/json" },
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
