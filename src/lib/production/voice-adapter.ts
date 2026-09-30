export type VoiceRequest = { text: string; voice: string; language: string };
export type VoiceConfig = { baseUrl: string; apiKey?: string; model?: string };
export type VoiceResult = { audio: Buffer; mimeType: string; provider: "voicestudio" };
type Fetcher = (url: URL, init: RequestInit) => Promise<Response>;

export async function requestVoiceAudio(config: VoiceConfig, input: VoiceRequest, fetcher: Fetcher = fetch): Promise<VoiceResult> {
  if (!config.baseUrl.trim()) throw new Error("VoiceStudio indisponível: configure VOICESTUDIO_BASE_URL para um serviço acessível pelo servidor Scriptly.");
  const base = new URL(config.baseUrl);
  if (!["https:", "http:"].includes(base.protocol) || base.username || base.password) throw new Error("VOICESTUDIO_BASE_URL deve ser uma URL HTTP(S) sem credenciais embutidas.");
  const endpoint = new URL("/v1/audio/speech", base);
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "audio/mpeg" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const response = await fetcher(endpoint, {
    method: "POST", headers,
    body: JSON.stringify({ model: config.model || "tts-1", voice: input.voice, input: input.text, response_format: "mp3" }),
    signal: AbortSignal.timeout(5 * 60 * 1000), redirect: "error", cache: "no-store",
  });
  if (!response.ok) throw new Error(`VoiceStudio respondeu HTTP ${response.status}.`);
  const mimeType = response.headers.get("content-type")?.split(";")[0] || "audio/mpeg";
  if (!/^audio\/(mpeg|mp3|wav|x-wav|ogg)$/i.test(mimeType)) throw new Error("VoiceStudio não retornou um formato de áudio reconhecido.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 80 * 1024 * 1024) throw new Error("VoiceStudio retornou áudio vazio ou maior que 80 MB.");
  return { audio: bytes, mimeType, provider: "voicestudio" };
}
