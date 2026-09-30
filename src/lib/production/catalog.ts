import type { VisualElement } from "./models";
import catalogData from "./data/catalogo.json" with { type: "json" };
import cueData from "./data/cues.json" with { type: "json" };
import priorityData from "./data/prioridade.json" with { type: "json" };

export const PRODUCTION_STYLES = {
  broadcast: { label: "Broadcast", fontSize: 30, marginV: 54, primaryColour: "&H00FFFFFF", backColour: "&H90000000", alignment: 2 },
  cinema: { label: "Cinema", fontSize: 34, marginV: 72, primaryColour: "&H00FFFFFF", backColour: "&H70000000", alignment: 2 },
  dossie: { label: "Dossiê", fontSize: 28, marginV: 46, primaryColour: "&H00F4E8C5", backColour: "&H900B1424", alignment: 2 },
  kinetico: { label: "Cinético", fontSize: 32, marginV: 40, primaryColour: "&H00FFFFFF", backColour: "&H900B1424", alignment: 2 },
} as const;

export const ELEMENT_PRIORITIES = priorityData.elements;
export type PriorityConfig = Record<keyof typeof priorityData.elements, number>;
export const AUDIO_MIX_DEFAULTS = { narrationVolume: 1, musicVolume: 0.25, effectsVolume: 0.8, ducking: cueData.ducking };

/** Empty usable libraries are safer than presenting placeholder tracks as licensed audio. */
export const AUDIO_CATALOG = {
  seedLabel: catalogData.seedType,
  description: catalogData.description,
  music: catalogData.music as { id: string; title: string; path: string; license: string; attribution: string; demo?: boolean }[],
  effects: catalogData.effects as { id: string; title: string; path: string; license: string; attribution: string; demo?: boolean }[],
};

export const AUDIO_CUES = cueData;

export type TimedVisual = VisualElement & { start: number; end: number };

export function winningVisualIntervals(elements: TimedVisual[], priorities: PriorityConfig = ELEMENT_PRIORITIES) {
  const boundaries = [...new Set(elements.flatMap(({ start, end }) => [start, end]))].sort((a, b) => a - b);
  const output: (TimedVisual & { priority: number })[] = [];
  for (let index = 0; index < boundaries.length - 1; index++) {
    const start = boundaries[index], end = boundaries[index + 1];
    const active = elements.filter((item) => item.start < end && item.end > start)
      .sort((a, b) => priorities[b.type] - priorities[a.type] || a.id.localeCompare(b.id));
    const winner = active[0];
    if (!winner) continue;
    const last = output[output.length - 1];
    if (last && last.id === winner.id && last.end === start) last.end = end;
    else output.push({ ...winner, start, end, priority: priorities[winner.type] });
  }
  return output;
}
