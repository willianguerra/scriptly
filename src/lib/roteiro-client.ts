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

/** Caracteres-alvo de cada parte na geração longa. */
export const ALVO_POR_PARTE = 5000;
/** Últimos caracteres do que já foi escrito, enviados como contexto. */
const TAIL_CHARS = 1500;

/**
 * Gera um roteiro possivelmente longo, dividindo em partes de ~5.000 caracteres
 * e emendando com continuidade. `tamanhoAlvo` é o total em caracteres; 0 ou
 * ausente (ou <= uma parte) gera numa única chamada.
 */
export async function gerarRoteiroLongo(
  params: Omit<GerarRoteiroParams, "parteAtual" | "totalPartes" | "trechoAnterior" | "alvoCaracteres"> & {
    tamanhoAlvo?: number;
    onParte?: (atual: number, total: number) => void;
  }
): Promise<{ texto: string; provider: ProviderRoteiro; modelo: string }> {
  const { tamanhoAlvo, onParte, ...base } = params;
  const total =
    tamanhoAlvo && tamanhoAlvo > ALVO_POR_PARTE
      ? Math.ceil(tamanhoAlvo / ALVO_POR_PARTE)
      : 1;

  let acumulado = "";
  let ultimoModelo = "";
  for (let i = 1; i <= total; i++) {
    onParte?.(i, total);
    const r = await gerarRoteiro({
      ...base,
      parteAtual: total > 1 ? i : undefined,
      totalPartes: total > 1 ? total : undefined,
      trechoAnterior:
        total > 1 && acumulado ? acumulado.slice(-TAIL_CHARS) : undefined,
      alvoCaracteres: total > 1 ? ALVO_POR_PARTE : undefined,
    });
    const trecho = r.texto.trim();
    if (trecho) acumulado += (acumulado ? "\n\n" : "") + trecho;
    ultimoModelo = r.modelo;
  }

  return { texto: acumulado, provider: base.provider, modelo: ultimoModelo };
}
