import "server-only";
import { requestVoiceAudio, type VoiceRequest, type VoiceResult } from "./voice-adapter";

export function voiceStudioAvailability() {
  return { available: Boolean(process.env.VOICESTUDIO_BASE_URL?.trim()), provider: "VoiceStudio", mode: "OpenAI-compatible HTTP API" };
}

export function generateWithVoiceStudio(input: VoiceRequest): Promise<VoiceResult> {
  return requestVoiceAudio({
    baseUrl: process.env.VOICESTUDIO_BASE_URL || "",
    apiKey: process.env.VOICESTUDIO_API_KEY?.trim(),
    model: process.env.VOICESTUDIO_MODEL || "tts-1",
  }, input);
}
