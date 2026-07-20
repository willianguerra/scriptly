"use client";

// Orquestrador do "Gerar tudo automaticamente": encadeia roteiro → narração →
// sincronização → prompts de cena, persistindo a cada passo. Roda no navegador
// (usa AudioContext e o Whisper local). O áudio não é salvo — só os artefatos
// de texto, como no fluxo manual.

import {
  audioBufferToMono16k,
  sliceAudioBuffer,
  SEGMENT_SECONDS,
} from "@/lib/audioUtils";
import {
  aguardarConclusao,
  baixarAudioBlob,
  criarAudio,
  listarVozes,
} from "@/lib/darkvi";
import {
  montarTimings,
  segmentosParaSRT,
  segmentosParaTexto,
  type Segmento,
} from "@/lib/roteiro/sync";
import { gerarRoteiro } from "@/lib/roteiro-client";
import { gerarRespostaChat } from "@/lib/video-prompts/client";
import type { MensagemChatPrompts } from "@/lib/video-prompts/flow";
import { transcribeSamples } from "@/lib/whisper-browser";
import {
  escolherVozPreferida,
  lerPreferenciaVoz,
  salvarPreferenciaVoz,
} from "@/lib/voice-preference";
import { atualizarVideo } from "@/lib/videos/client";
import type { ProviderRoteiro } from "@/lib/roteiro/types";
import type { VideoSalvo } from "@/types/video";

const PROVIDERS_VALIDOS: ProviderRoteiro[] = ["fake", "gemini", "openai"];

function normalizarProvider(valor: string | null): ProviderRoteiro {
  return PROVIDERS_VALIDOS.includes(valor as ProviderRoteiro)
    ? (valor as ProviderRoteiro)
    : "fake";
}

export type PipelineEtapa =
  | "roteiro"
  | "narracao"
  | "sincronizacao"
  | "prompts"
  | "concluido";

export type PipelineProgresso = {
  etapa: PipelineEtapa;
  detalhe?: string;
};

type PipelineOpts = {
  username: string;
  onProgress: (p: PipelineProgresso) => void;
  onPatch?: (patch: Partial<VideoSalvo>) => void;
};

function idMsg() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random());
}

/**
 * Executa a esteira completa para um vídeo. Reaproveita o roteiro já existente
 * (se houver) e gera todo o resto. Lança um erro com o passo que falhou.
 */
export async function executarPipeline(
  video: VideoSalvo,
  { username, onProgress, onPatch }: PipelineOpts
): Promise<void> {
  const provider = normalizarProvider(video.provider);

  // 1) Roteiro — usa o existente ou gera a partir do tema (ou do título).
  onProgress({ etapa: "roteiro" });
  let roteiro = (video.roteiro ?? "").trim();
  let tema = (video.tema ?? "").trim();
  if (!roteiro) {
    if (!tema) tema = video.titulo.trim();
    const resultado = await gerarRoteiro({
      provider,
      tema,
      promptSistema: video.promptSistema?.trim() || undefined,
    });
    roteiro = resultado.texto.trim();
    await atualizarVideo(video.id, { roteiro, tema, provider });
    onPatch?.({ roteiro, tema, provider });
  }
  if (!roteiro) throw new Error("Não foi possível obter o roteiro.");

  // 2) Narração — gera o áudio (efêmero) e salva só a voz escolhida.
  onProgress({ etapa: "narracao" });
  const vozes = await listarVozes();
  if (vozes.length === 0) {
    throw new Error(
      "Nenhuma voz disponível. Configure a chave da Darkvi em Configurações."
    );
  }
  const ids = vozes.map((v) => v.idApi);
  const voz =
    video.voz && ids.includes(video.voz)
      ? video.voz
      : escolherVozPreferida(ids, lerPreferenciaVoz(username));

  const audioId = await criarAudio({ text: roteiro, voice: voz });
  await aguardarConclusao(audioId);
  const blob = await baixarAudioBlob(audioId);
  salvarPreferenciaVoz(voz, username);
  await atualizarVideo(video.id, { voz });
  onPatch?.({ voz });

  // 3) Sincronização — transcreve o áudio em blocos (Whisper no navegador).
  onProgress({ etapa: "sincronizacao", detalhe: "preparando" });
  let ctx: AudioContext | null = null;
  let segmentos: Segmento[] = [];
  let duracao = 0;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new AudioCtx();
    const arr = await blob.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arr.slice(0));
    duracao = buffer.duration;

    const brutos = sliceAudioBuffer(buffer, SEGMENT_SECONDS, ctx);
    if (brutos.length === 0) {
      throw new Error("Não foi possível dividir o áudio em blocos.");
    }
    const novos: Segmento[] = [];
    let concluidos = 0;
    for (const bruto of brutos) {
      const samples = await audioBufferToMono16k(bruto.buffer);
      const texto = await transcribeSamples(samples, {
        language: "portuguese",
        onModelProgress: (pct) => {
          if (pct < 100) {
            onProgress({
              etapa: "sincronizacao",
              detalhe: `baixando modelo ${pct}%`,
            });
          }
        },
      });
      novos.push({ texto, inicio: bruto.start, fim: bruto.end });
      concluidos += 1;
      onProgress({
        etapa: "sincronizacao",
        detalhe: `${concluidos}/${brutos.length} blocos`,
      });
    }
    segmentos = novos;
  } finally {
    ctx?.close().catch(() => {});
  }

  const timings = montarTimings(segmentos, duracao);
  const srt = segmentosParaSRT(segmentos);
  await atualizarVideo(video.id, { segmentos, timings, srt });
  onPatch?.({ segmentos, timings, srt });

  // 4) Prompts de cena — agente DOTTI em 3 etapas (análise → referências → cenas).
  onProgress({ etapa: "prompts", detalhe: "análise" });
  const sincronizacao = segmentosParaTexto(segmentos, timings.duracao);
  let mensagens: MensagemChatPrompts[] = [];

  const analise = await gerarRespostaChat({
    provider,
    etapa: "analise",
    roteiro,
    sincronizacao,
    mensagens,
  });
  mensagens = [
    ...mensagens,
    { id: idMsg(), role: "user", content: "Analisar roteiro." },
    { id: idMsg(), role: "assistant", content: analise.texto },
  ];

  onProgress({ etapa: "prompts", detalhe: "referências" });
  const referencias = await gerarRespostaChat({
    provider,
    etapa: "referencias",
    roteiro,
    sincronizacao,
    mensagens,
  });
  mensagens = [
    ...mensagens,
    { id: idMsg(), role: "user", content: "Confirmar e gerar referências." },
    { id: idMsg(), role: "assistant", content: referencias.texto },
  ];

  onProgress({ etapa: "prompts", detalhe: "cenas" });
  const cenas = await gerarRespostaChat({
    provider,
    etapa: "cenas",
    roteiro,
    sincronizacao,
    mensagens,
  });

  const promptsCena = cenas.texto;
  await atualizarVideo(video.id, { promptsCena });
  onPatch?.({ promptsCena });

  onProgress({ etapa: "concluido" });
}
