import { sceneListSchema, type ProductionScene } from "./models.ts";
import { isAuthorizedPexelsDownload } from "./pexels-adapter.ts";
import { AUDIO_MIX_DEFAULTS } from "./catalog.ts";

export type RenderProjectInput = {
  scenes: unknown; narration: unknown; aspectRatio: string; renderSettings: unknown;
};
export type RenderPlan = {
  scenes: ProductionScene[]; narrationPath: string; width: number; height: number; durationSeconds: number;
  audioMix: typeof AUDIO_MIX_DEFAULTS;
};

export function buildRenderPlan(project: RenderProjectInput): RenderPlan {
  const scenes = sceneListSchema.parse(project.scenes);
  if (!scenes.length) throw new Error("O roteiro não contém cenas para exportar.");
  if (!project.narration || typeof project.narration !== "object" || typeof (project.narration as { path?: unknown }).path !== "string") throw new Error("Gere ou envie a narração antes de exportar.");
  let durationSeconds = 0;
  for (const scene of scenes) {
    const selected = scene.candidates.find((candidate) => candidate.id === scene.selectedCandidateId);
    if (!selected) throw new Error(`A cena ${scene.order} não tem um clipe selecionado.`);
    if (selected.provider === "pexels" && !isAuthorizedPexelsDownload(selected.downloadUrl)) throw new Error(`A origem do clipe selecionado na cena ${scene.order} não é válida.`);
    const end = scene.trimOutSeconds ?? scene.durationSeconds;
    if (end <= scene.trimInSeconds) throw new Error(`Recorte inválido na cena ${scene.order}.`);
    if (end > selected.durationSeconds) throw new Error(`O recorte da cena ${scene.order} excede a duração do clipe (${selected.durationSeconds}s).`);
    durationSeconds += end - scene.trimInSeconds;
  }
  if (durationSeconds > 7200) throw new Error("A duração editada excede o limite de 2 horas.");
  const settings = project.renderSettings && typeof project.renderSettings === "object" ? project.renderSettings as Record<string, unknown> : {};
  const ratio = project.aspectRatio;
  const widthFallback = ratio === "9:16" ? 1080 : 1920;
  const heightFallback = ratio === "9:16" ? 1920 : 1080;
  const width = Math.max(720, Math.min(1920, Math.round(Number(settings.width || widthFallback) / 2) * 2));
  const height = Math.max(720, Math.min(1920, Math.round(Number(settings.height || heightFallback) / 2) * 2));
  const savedMix = settings.audioMix && typeof settings.audioMix === "object" ? settings.audioMix as Record<string, unknown> : {};
  const clamp = (key: keyof typeof AUDIO_MIX_DEFAULTS, fallback: number, max: number) => {
    const value = Number(savedMix[key] ?? fallback);
    return Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback;
  };
  const audioMix = {
    narrationVolume: clamp("narrationVolume", AUDIO_MIX_DEFAULTS.narrationVolume, 2),
    musicVolume: clamp("musicVolume", AUDIO_MIX_DEFAULTS.musicVolume, 2),
    effectsVolume: clamp("effectsVolume", AUDIO_MIX_DEFAULTS.effectsVolume, 2),
    ducking: clamp("ducking", AUDIO_MIX_DEFAULTS.ducking, 1),
  };
  return { scenes, narrationPath: (project.narration as { path: string }).path, width, height, durationSeconds, audioMix };
}
