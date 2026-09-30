export type SubtitleCue = { start: number; end: number; text: string };
const timestamp = /^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/;
const toSeconds = (h: string, m: string, s: string, ms: string) => Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;

export function parseSrt(value: string): SubtitleCue[] {
  const lines = value.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
  const cues: SubtitleCue[] = [];
  for (let index = 0; index < lines.length; index++) {
    const match = timestamp.exec(lines[index].trim());
    if (!match) continue;
    const start = toSeconds(match[1], match[2], match[3], match[4]);
    const end = toSeconds(match[5], match[6], match[7], match[8]);
    const text: string[] = [];
    for (index++; index < lines.length && lines[index].trim(); index++) text.push(lines[index].trim());
    if (end > start && text.length) cues.push({ start, end, text: text.join(" ").replace(/[{}]/g, "") });
  }
  return cues;
}

export function serializeSrt(cues: SubtitleCue[]): string {
  const format = (seconds: number) => {
    const ms = Math.max(0, Math.round(seconds * 1000));
    const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000), milli = ms % 1000;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(milli).padStart(3, "0")}`;
  };
  return cues.map((cue, index) => `${index + 1}\n${format(cue.start)} --> ${format(cue.end)}\n${cue.text.replace(/[\r\n]+/g, " ")}\n`).join("\n");
}
