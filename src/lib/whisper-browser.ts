// Serviço de transcrição que roda 100% no navegador, usando Whisper via
// transformers.js (Hugging Face). Não requer chave de API nem servidor: o modelo
// é baixado uma vez (e fica em cache do navegador) e a inferência acontece no
// cliente. O import é dinâmico para não inflar o bundle inicial nem rodar no SSR.

import type { Segmento } from "@/lib/roteiro/sync";

// Usamos o repositório "onnx-community", preparado para transformers.js v3, com
// dtypes testados para WebGPU e WASM.
const MODEL_ID = "onnx-community/whisper-base";

export type ModelProgressCallback = (percent: number) => void;

export interface TranscribeSamplesOptions {
  /**
   * Idioma do áudio (nome em inglês, ex.: "portuguese", "english").
   * Quando omitido (ou "auto"), o Whisper detecta o idioma automaticamente e
   * transcreve na mesma língua falada — sem traduzir.
   */
  language?: string;
  /** Progresso de download do modelo (0-100), útil na primeira execução. */
  onModelProgress?: ModelProgressCallback;
}

type ProgressData = {
  status: string;
  file?: string;
  loaded?: number;
  total?: number;
};

type AsrChunk = { text?: string; timestamp?: [number, number | null] };
type AsrOutput =
  | { text?: string; chunks?: AsrChunk[] }
  | Array<{ text?: string; chunks?: AsrChunk[] }>;
type AsrPipeline = (
  input: Float32Array,
  options?: Record<string, unknown>
) => Promise<AsrOutput>;

// Configurações de carregamento em ordem de preferência. A primeira que
// inicializar com sucesso é usada. WebGPU é mais rápido; WASM é o mais
// compatível; fp32 é o fallback final mais pesado, porém mais robusto.
type LoadConfig = { device: string; dtype: string | Record<string, string> };

function buildLoadConfigs(): LoadConfig[] {
  const configs: LoadConfig[] = [];
  const hasWebGpu =
    typeof navigator !== "undefined" &&
    "gpu" in navigator &&
    Boolean((navigator as { gpu?: unknown }).gpu);

  if (hasWebGpu) {
    configs.push({
      device: "webgpu",
      dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
    });
  }
  configs.push({ device: "wasm", dtype: "q8" });
  configs.push({ device: "wasm", dtype: "fp32" });
  return configs;
}

let transcriberPromise: Promise<AsrPipeline> | null = null;

async function loadWithConfig(
  config: LoadConfig,
  onModelProgress?: ModelProgressCallback
): Promise<AsrPipeline> {
  const { pipeline, env } = await import("@huggingface/transformers");
  // Baixa os pesos do Hub remoto (não procura arquivos locais).
  env.allowLocalModels = false;

  // Agrega o progresso de download de todos os arquivos do modelo.
  const progressByFile = new Map<string, { loaded: number; total: number }>();

  const transcriber = await pipeline(
    "automatic-speech-recognition",
    MODEL_ID,
    {
      device: config.device,
      dtype: config.dtype,
      progress_callback: (data: ProgressData) => {
        if (!onModelProgress) return;
        if (!data.file) return;

        if (data.status === "done") {
          const current = progressByFile.get(data.file);
          if (current) {
            progressByFile.set(data.file, {
              loaded: current.total,
              total: current.total,
            });
          }
        } else if (
          typeof data.loaded === "number" &&
          typeof data.total === "number"
        ) {
          progressByFile.set(data.file, {
            loaded: data.loaded,
            total: data.total,
          });
        } else {
          return;
        }

        let loaded = 0;
        let total = 0;
        for (const value of progressByFile.values()) {
          loaded += value.loaded;
          total += value.total;
        }
        if (total > 0) {
          onModelProgress(Math.min(100, Math.round((loaded / total) * 100)));
        }
      },
    } as Record<string, unknown>
  );

  return transcriber as unknown as AsrPipeline;
}

async function getTranscriber(
  onModelProgress?: ModelProgressCallback
): Promise<AsrPipeline> {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const configs = buildLoadConfigs();
      let lastError: unknown;
      for (const config of configs) {
        try {
          return await loadWithConfig(config, onModelProgress);
        } catch (error) {
          lastError = error;
          // tenta a próxima configuração (ex.: WebGPU falhou -> WASM)
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error("Não foi possível carregar o modelo de transcrição.");
    })();

    // Se todas as configurações falharem, permite tentar de novo numa próxima chamada.
    transcriberPromise.catch(() => {
      transcriberPromise = null;
    });
  }
  return transcriberPromise;
}

/** Taxa de amostragem esperada pelo Whisper. */
const SAMPLE_RATE = 16000;
/** Duração mínima (em segundos) para tentar transcrever um trecho. */
const MIN_SAMPLE_SECONDS = 0.2;
/** Limiar de energia (RMS) abaixo do qual o trecho é considerado silêncio. */
const SILENCE_RMS_THRESHOLD = 0.0025;

/** Calcula o RMS (energia média) das amostras para detectar silêncio. */
function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i];
    sum += value * value;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Transcreve amostras de áudio mono a 16 kHz (Float32Array).
 * Retorna o texto transcrito já com espaços normalizados.
 *
 * Trechos vazios, muito curtos ou silenciosos retornam string vazia sem chamar
 * o modelo: o Whisper geraria zero tokens e o tokenizer lançaria
 * "token_ids must be a non-empty array of integers".
 */
export async function transcribeSamples(
  samples: Float32Array,
  options: TranscribeSamplesOptions = {}
): Promise<string> {
  const durationSeconds = samples.length / SAMPLE_RATE;
  if (durationSeconds < MIN_SAMPLE_SECONDS) return "";
  if (computeRms(samples) < SILENCE_RMS_THRESHOLD) return "";

  const transcriber = await getTranscriber(options.onModelProgress);

  // task "transcribe" mantém o texto no idioma falado (nunca traduz; "translate"
  // é que converteria para inglês). Quando nenhum idioma é informado (ou "auto"),
  // deixamos a chave `language` de fora para o Whisper detectar sozinho — assim
  // forçar o idioma errado não distorce a transcrição.
  const language = options.language?.trim().toLowerCase();
  const runtimeOptions: Record<string, unknown> = {
    task: "transcribe",
  };
  if (language && language !== "auto") {
    runtimeOptions.language = language;
  }
  // chunk_length_s só é necessário para áudios acima da janela nativa de 30s do
  // Whisper. Em trechos curtos ele ativa o caminho de "long-form", que é o que
  // dispara o erro de tokens vazios quando há pouca/nenhuma fala.
  if (durationSeconds > 30) {
    runtimeOptions.chunk_length_s = 30;
    runtimeOptions.stride_length_s = 5;
  }

  const result = await transcriber(samples, runtimeOptions);

  const text = Array.isArray(result)
    ? result.map((item) => item.text ?? "").join(" ")
    : result.text ?? "";

  return text.trim();
}

/**
 * Transcreve o áudio pedindo timestamps por palavra (`return_timestamps:
 * "word"`) e devolve o texto completo mais os segmentos alinhados. É a base da
 * etapa de sincronização (PLAN.md Fase 3): geramos a narração pelo TTS e depois
 * "carimbamos" os tempos transcrevendo o próprio áudio.
 *
 * `duracaoSegundos` é usada apenas como limite para descartar timestamps
 * incoerentes (o Whisper às vezes devolve `null` no fim da última palavra).
 */
export async function transcribeSamplesWithTimestamps(
  samples: Float32Array,
  options: TranscribeSamplesOptions & { duracaoSegundos?: number } = {}
): Promise<{ texto: string; palavras: Segmento[] }> {
  const durationSeconds =
    options.duracaoSegundos ?? samples.length / SAMPLE_RATE;
  if (samples.length / SAMPLE_RATE < MIN_SAMPLE_SECONDS) {
    return { texto: "", palavras: [] };
  }

  const transcriber = await getTranscriber(options.onModelProgress);

  const language = options.language?.trim().toLowerCase();
  const runtimeOptions: Record<string, unknown> = {
    task: "transcribe",
    return_timestamps: "word",
  };
  if (language && language !== "auto") {
    runtimeOptions.language = language;
  }
  if (durationSeconds > 30) {
    runtimeOptions.chunk_length_s = 30;
    runtimeOptions.stride_length_s = 5;
  }

  const result = await transcriber(samples, runtimeOptions);
  const primeiro = Array.isArray(result) ? result[0] : result;

  const texto = (primeiro?.text ?? "").trim();
  const chunks = primeiro?.chunks ?? [];

  const palavras: Segmento[] = [];
  let ultimoFim = 0;
  for (const chunk of chunks) {
    const t = (chunk.text ?? "").trim();
    if (!t) continue;
    const inicio = chunk.timestamp?.[0];
    // O fim pode vir null (última palavra): usa o início da próxima ou a duração.
    const fimBruto = chunk.timestamp?.[1];
    if (typeof inicio !== "number") continue;
    const fim =
      typeof fimBruto === "number" ? fimBruto : Math.min(durationSeconds, inicio + 0.4);
    const inicioSeguro = Math.max(inicio, ultimoFim === 0 ? inicio : 0);
    palavras.push({ texto: t, inicio: inicioSeguro, fim: Math.max(fim, inicioSeguro) });
    ultimoFim = fim;
  }

  return { texto, palavras };
}
