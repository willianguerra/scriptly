// Utilitários para o "Divisor de Áudio": validação, formatação de tempo,
// fatiamento do áudio em blocos e codificação WAV dos trechos.

import type { AudioSegment, AudioSegmentExport } from "@/types/audio";

/** Duração padrão de cada bloco de áudio, em segundos. */
export const SEGMENT_SECONDS = 8;

/** Limites permitidos para a duração de cada bloco, em segundos. */
export const MIN_SEGMENT_SECONDS = 1;
export const MAX_SEGMENT_SECONDS = 60;

/** Tamanho máximo permitido para o arquivo de áudio (50 MB). */
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

/** Extensões aceitas no upload. */
export const ACCEPTED_AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "ogg"] as const;

/** Tipos MIME aceitos (inclui webm das gravações pelo navegador). */
export const ACCEPTED_AUDIO_MIME = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
];

/** Valor do atributo `accept` para o input de arquivo. */
export const AUDIO_ACCEPT_ATTR = ".mp3,.wav,.m4a,.ogg,audio/*";

/** Formata segundos no padrão MM:SS. */
export function formatTime(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Valida o arquivo de áudio. Retorna a mensagem de erro ou `null` se ok. */
export function validateAudioFile(file: File | null | undefined): string | null {
  if (!file) return "Selecione um arquivo de áudio.";

  if (file.size === 0) return "O arquivo de áudio está vazio.";

  if (file.size > MAX_AUDIO_BYTES) {
    const mb = Math.round(MAX_AUDIO_BYTES / (1024 * 1024));
    return `Arquivo muito grande. Tamanho máximo permitido: ${mb} MB.`;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extensionOk = (ACCEPTED_AUDIO_EXTENSIONS as readonly string[]).includes(extension);
  const mimeOk = file.type
    ? ACCEPTED_AUDIO_MIME.includes(file.type) || file.type.startsWith("audio/")
    : false;

  if (!extensionOk && !mimeOk) {
    const formatos = ACCEPTED_AUDIO_EXTENSIONS.join(", ").toUpperCase();
    return `Formato não suportado. Utilize um dos formatos: ${formatos}.`;
  }

  return null;
}

/** Decodifica um arquivo de áudio em um AudioBuffer. */
export async function decodeAudioFile(
  file: File,
  audioContext: BaseAudioContext
): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  try {
    // `decodeAudioData` baseado em Promise (slice evita reaproveitar buffer destacado).
    return await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    throw new Error(
      "Não foi possível ler o áudio. O arquivo pode estar corrompido ou em um formato não suportado pelo navegador."
    );
  }
}

export interface RawAudioSegment {
  index: number;
  start: number;
  end: number;
  buffer: AudioBuffer;
}

/** Fatia um AudioBuffer em blocos de `segmentSeconds` segundos. */
export function sliceAudioBuffer(
  buffer: AudioBuffer,
  segmentSeconds: number,
  audioContext: BaseAudioContext
): RawAudioSegment[] {
  const { sampleRate, numberOfChannels, duration } = buffer;
  const totalSegments = Math.max(1, Math.ceil(duration / segmentSeconds));
  const segments: RawAudioSegment[] = [];

  for (let i = 0; i < totalSegments; i++) {
    const start = i * segmentSeconds;
    const end = Math.min((i + 1) * segmentSeconds, duration);
    const startFrame = Math.floor(start * sampleRate);
    const endFrame = Math.min(Math.floor(end * sampleRate), buffer.length);
    const frameCount = endFrame - startFrame;
    if (frameCount <= 0) continue;

    const segmentBuffer = audioContext.createBuffer(
      numberOfChannels,
      frameCount,
      sampleRate
    );

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = buffer
        .getChannelData(channel)
        .subarray(startFrame, endFrame);
      segmentBuffer.copyToChannel(channelData, channel);
    }

    segments.push({ index: i + 1, start, end, buffer: segmentBuffer });
  }

  return segments;
}

/**
 * Reamostra um AudioBuffer para mono a 16 kHz (formato esperado pelo Whisper),
 * devolvendo as amostras como Float32Array.
 */
export async function audioBufferToMono16k(buffer: AudioBuffer): Promise<Float32Array> {
  const targetRate = 16000;
  const frameCount = Math.max(1, Math.ceil(buffer.duration * targetRate));

  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;

  const offline = new OfflineCtx(1, frameCount, targetRate);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

/** Converte um AudioBuffer em um Blob WAV (PCM 16-bit). */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  // Cabeçalho RIFF/WAVE.
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // tamanho do bloco fmt
  view.setUint16(20, 1, true); // formato PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits por amostra
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let channel = 0; channel < numChannels; channel++) {
    channels.push(buffer.getChannelData(channel));
  }

  let offset = 44;
  for (let frame = 0; frame < numFrames; frame++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][frame];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export interface PromptExportInfo {
  /** Nome do arquivo de áudio de origem. */
  fileName: string;
  /** Duração total do áudio, em segundos. */
  duration: number;
  /** Duração de cada bloco, em segundos. */
  segmentSeconds: number;
}

/**
 * Monta o texto final no padrão de sincronização:
 *
 *   PROMPT 001 | 00:00 - 00:08
 *   <transcrição>
 *   ----------------------------------------
 */
export function buildPromptTextExport(
  segments: AudioSegment[],
  info: PromptExportInfo
): string {
  const linha = "=".repeat(60);
  const separador = "-".repeat(60);
  const { fileName, duration, segmentSeconds } = info;

  const cabecalho = [
    linha,
    `SINCRONIZAÇÃO DOTTI SYNC - GROK ${segmentSeconds}s - BLOCOS DE ${segmentSeconds}s`,
    linha,
    `Arquivo: ${fileName}`,
    `Duração: ${formatTime(duration)}`,
    `Total de prompts: ${segments.length}`,
    linha,
  ].join("\n");

  const corpo = segments
    .map((segment) => {
      const numero = String(segment.index).padStart(3, "0");
      const titulo = `PROMPT ${numero} | ${formatTime(segment.start)} - ${formatTime(segment.end)}`;
      const texto = segment.transcript.trim() || "[sem transcrição]";
      return `${titulo}\n${texto}\n${separador}`;
    })
    .join("\n\n");

  return `${cabecalho}\n\n${corpo}\n`;
}

/** Monta a estrutura JSON exportável dos trechos. */
export function buildJsonExport(segments: AudioSegment[]): AudioSegmentExport[] {
  return segments.map((segment) => ({
    parte: segment.index,
    inicio: formatTime(segment.start),
    fim: formatTime(segment.end),
    inicioSegundos: Number(segment.start.toFixed(3)),
    fimSegundos: Number(segment.end.toFixed(3)),
    transcricao: segment.transcript.trim(),
  }));
}
