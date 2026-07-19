// Helpers para reconstruir os artefatos do Estúdio salvos no vídeo (Json) para
// o formato usado pela UI.

import {
  segmentosParaTexto,
  type Segmento,
  type Timings,
} from "@/lib/roteiro/sync";
import type { VideoSalvo } from "@/types/video";

export function segmentosDoVideo(valor: unknown): Segmento[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter(
    (s): s is Segmento =>
      !!s &&
      typeof s === "object" &&
      typeof (s as Segmento).texto === "string" &&
      typeof (s as Segmento).inicio === "number" &&
      typeof (s as Segmento).fim === "number"
  );
}

// Texto de sincronização (mesmo formato que alimenta o agente de prompts).
export function sincronizacaoTexto(video: VideoSalvo): string {
  const segmentos = segmentosDoVideo(video.segmentos);
  if (segmentos.length === 0) return "";
  const duracao = (video.timings as Timings | null)?.duracao ?? 0;
  return segmentosParaTexto(segmentos, duracao);
}
