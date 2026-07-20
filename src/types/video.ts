// Tipo compartilhado (cliente/servidor) de um vídeo persistido.
// Os campos de artefato (roteiro, segmentos, timings, srt) espelham o que o
// Estúdio produz; o áudio da narração NÃO é persistido.
export interface VideoSalvo {
  id: string;
  channelId: string;
  titulo: string;
  tema: string | null;
  scheduledAt: number | null;
  promptSistema: string | null;
  provider: string | null;
  roteiro: string | null;
  voz: string | null;
  segmentos: unknown;
  timings: unknown;
  srt: string | null;
  promptsCena: string | null;
  notas: string | null;
  criadoEm: number;
  atualizadoEm: number;
}
