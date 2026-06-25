// Serviço de transcrição que roda 100% no navegador, usando Whisper via
// transformers.js (Hugging Face). Não requer chave de API nem servidor: o modelo
// é baixado uma vez (e fica em cache do navegador) e a inferência acontece no
// cliente. O import é dinâmico para não inflar o bundle inicial nem rodar no SSR.

// Usamos o repositório "onnx-community", preparado para transformers.js v3, com
// dtypes testados para WebGPU e WASM.
const MODEL_ID = "onnx-community/whisper-base";

export type ModelProgressCallback = (percent: number) => void;

export interface TranscribeSamplesOptions {
  /** Idioma do áudio (nome em inglês, ex.: "portuguese", "english"). */
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

type AsrOutput = { text?: string } | Array<{ text?: string }>;
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

/**
 * Transcreve amostras de áudio mono a 16 kHz (Float32Array).
 * Retorna o texto transcrito já com espaços normalizados.
 */
export async function transcribeSamples(
  samples: Float32Array,
  options: TranscribeSamplesOptions = {}
): Promise<string> {
  const transcriber = await getTranscriber(options.onModelProgress);
  const result = await transcriber(samples, {
    language: options.language ?? "portuguese",
    task: "transcribe",
    chunk_length_s: 30,
  });

  const text = Array.isArray(result)
    ? result.map((item) => item.text ?? "").join(" ")
    : result.text ?? "";

  return text.trim();
}
