// Deriva o estágio do vídeo a partir dos artefatos presentes — não há um campo
// de status no banco; o progresso é inferido do que já foi produzido.

import type { VideoSalvo } from "@/types/video";

export type EstagioVideo = {
  id: "ideia" | "roteiro" | "narracao" | "sincronizado";
  rotulo: string;
  classe: string;
  progresso: number;
};

function temSincronizacao(v: VideoSalvo): boolean {
  if (typeof v.srt === "string" && v.srt.trim().length > 0) return true;
  return Array.isArray(v.segmentos) && v.segmentos.length > 0;
}

export function estagioDoVideo(v: VideoSalvo): EstagioVideo {
  if (temSincronizacao(v)) {
    return {
      id: "sincronizado",
      rotulo: "Sincronizado",
      classe: "bg-emerald-500/10 text-emerald-500",
      progresso: 100,
    };
  }
  if (v.voz && v.voz.trim().length > 0) {
    return {
      id: "narracao",
      rotulo: "Narração",
      classe: "bg-amber-500/10 text-amber-500",
      progresso: 66,
    };
  }
  if (v.roteiro && v.roteiro.trim().length > 0) {
    return {
      id: "roteiro",
      rotulo: "Roteiro",
      classe: "bg-primary/10 text-primary",
      progresso: 33,
    };
  }
  return {
    id: "ideia",
    rotulo: "Ideia",
    classe: "bg-muted text-muted-foreground",
    progresso: 0,
  };
}
