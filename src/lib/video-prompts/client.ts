import { getChave } from "@/lib/roteiro-client";
import type { ProviderRoteiro } from "@/lib/roteiro/types";
import type {
  EtapaChatPrompts,
  MensagemChatPrompts,
} from "@/lib/video-prompts/flow";

const HEADER_KEYS = {
  gemini: "x-gemini-key",
  openai: "x-openai-key",
} as const;

export type GerarRespostaChatParams = {
  provider: ProviderRoteiro;
  etapa: EtapaChatPrompts;
  roteiro: string;
  sincronizacao: string;
  mensagens: MensagemChatPrompts[];
  mensagemUsuario?: string;
  modelo?: string;
};

export async function gerarRespostaChat(
  params: GerarRespostaChatParams
): Promise<{ texto: string; provider: ProviderRoteiro; modelo: string }> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (params.provider !== "fake") {
    const chave = getChave(params.provider).trim();
    if (chave) headers[HEADER_KEYS[params.provider]] = chave;
  }

  const res = await fetch("/api/video-prompts", {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || `Erro ${res.status} ao gerar prompts.`);
  }
  return { texto: data.texto, provider: data.provider, modelo: data.modelo };
}
