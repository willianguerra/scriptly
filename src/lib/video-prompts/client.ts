import type { ProviderRoteiro } from "@/lib/roteiro/types";
import type {
  EtapaChatPrompts,
  MensagemChatPrompts,
} from "@/lib/video-prompts/flow";

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
  const res = await fetch("/api/video-prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || `Erro ${res.status} ao gerar prompts.`);
  }
  return { texto: data.texto, provider: data.provider, modelo: data.modelo };
}
