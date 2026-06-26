// Tipagens dos trechos de áudio usados na tela "Divisor de Áudio".

export type AudioSegmentStatus =
  | "pending"
  | "transcribing"
  | "done"
  | "error";

export interface AudioSegment {
  /** Número da parte (base 1). */
  index: number;
  /** Tempo inicial do trecho em segundos. */
  start: number;
  /** Tempo final do trecho em segundos. */
  end: number;
  /** Object URL para reprodução no player (opcional). */
  url?: string;
  /** Blob WAV do trecho (opcional). */
  blob?: Blob;
  /** Texto transcrito do trecho. */
  transcript: string;
  /** Estado atual da transcrição do trecho. */
  status: AudioSegmentStatus;
  /** Mensagem de erro caso a transcrição falhe. */
  error?: string;
}

/** Estrutura de cada parte ao exportar o resultado em JSON. */
export interface AudioSegmentExport {
  parte: number;
  inicio: string;
  fim: string;
  inicioSegundos: number;
  fimSegundos: number;
  transcricao: string;
}
