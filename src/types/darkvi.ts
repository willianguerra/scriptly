// Tipos da integração com a API Darkvi (TTS)
// Docs: https://darkvi.com/api

export interface DarkviVoice {
  // A API real retorna o UUID da voz no campo `idApi` (a doc dizia `id`).
  idApi: string;
  name: string;
  novidade?: boolean;
  language?: string;
  accent?: string;
  age?: string;
  OtherLanguage?: string[] | boolean;
  Urlpreview?: string;
}

export type DarkviStatus = "PENDING" | "PROCESSING" | "DONE" | "ERROR";

// Resposta de POST /api/tts
export interface DarkviCreateResponse {
  ok: boolean;
  message?: string;
  data?: {
    created?: {
      id: string;
      status: DarkviStatus;
    };
  };
}

// Resposta de GET /api/tts/:id
export interface DarkviTextSpeech {
  id: string;
  text: string;
  status: DarkviStatus;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  titulo?: string | null;
}

// Estado de geração de áudio por roteiro (mantido apenas em memória)
export interface RoteiroAudio {
  id?: string;
  status?: DarkviStatus | "IDLE" | "REQUESTING";
  erro?: string;
  audioUrl?: string; // object URL do MP3 baixado
}
