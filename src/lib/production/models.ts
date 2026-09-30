import { z } from "zod";
import { ELEMENT_PRIORITIES, type PriorityConfig, winningVisualIntervals } from "./catalog.ts";

export const jobStatusSchema = z.enum(["waiting", "processing", "completed", "error", "cancelled"]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const clipCandidateSchema = z.object({
  id: z.string(), provider: z.string(), sourceUrl: z.string().url(), previewUrl: z.string().url().nullable(),
  downloadUrl: z.string().url(), title: z.string(), creator: z.string(), creatorUrl: z.string().url().nullable(),
  license: z.string(), licenseUrl: z.string().url().nullable(), attribution: z.string(), durationSeconds: z.number().nonnegative(),
  width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable(), tags: z.array(z.string()),
  score: z.number().min(0).max(1), confidence: z.enum(["low", "medium", "high"]), justification: z.string(), exactSubjectVerified: z.boolean(),
});
export type ClipCandidate = z.infer<typeof clipCandidateSchema>;

export const sceneSchema = z.object({
  id: z.string(), order: z.number().int().positive(), scriptText: z.string().min(1), durationSeconds: z.number().positive(),
  startSeconds: z.number().nonnegative(), endSeconds: z.number().positive(), subject: z.string(), action: z.string(), environment: z.string(),
  visualIntent: z.string(), exactSubject: z.boolean(), searchQueries: z.array(z.object({ language: z.string(), query: z.string() })),
  avoidTerms: z.array(z.string()), candidates: z.array(clipCandidateSchema), selectedCandidateId: z.string().nullable(),
  trimInSeconds: z.number().nonnegative(), trimOutSeconds: z.number().positive().nullable(), titleText: z.string(), status: z.enum(["waiting", "searching", "ready", "selected"]),
});
export const sceneListSchema = z.array(sceneSchema).max(120);
export type ProductionScene = z.infer<typeof sceneSchema>;

const STOP_WORDS = new Set("a an and are as at be by com da das de do dos e em for how i in is it its o of on or os para pela pelo por que the to um uma uns this that their".split(" "));
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function words(value: string): string[] {
  return normalize(value).split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

const speciesQueries = [
  ["great white shark", "tubarao branco"], ["hammerhead shark", "tubarao-martelo"], ["tiger shark", "tubarao-tigre"],
  ["bull shark", "tubarao-touro"], ["whale shark", "tubarao-baleia"], ["goblin shark", "tubarao-duende"],
  ["mako shark", "tubarao-mako"], ["thresher shark", "tubarao-raposa"], ["nurse shark", "tubarao-enfermeiro"],
  ["cookiecutter shark", "tubarao-charuto"],
] as const;

export function buildScenesFromScript(script: string, _targetSeconds = 600): ProductionScene[] {
  if (!Number.isFinite(_targetSeconds) || _targetSeconds <= 0) throw new Error("A duração alvo deve ser maior que zero.");
  const fragments = script.split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim().replace(/^[-*•\d.)\s]+/, "")).filter(Boolean);
  const chosen = fragments.length ? fragments : [script.trim()].filter(Boolean);
  let cursor = 0;
  return chosen.map((fragment, index) => {
    const tokens = words(fragment);
    const duration = Math.max(5, Math.min(15, Math.ceil((tokens.length || 8) / 2.5)));
    const subject = tokens.slice(0, 4).join(" ") || "wildlife";
    const endSeconds = cursor + duration;
    const querySubject = speciesQueries.find(([english, portuguese]) => normalize(fragment).includes(english) || normalize(fragment).includes(portuguese)) || null;
    const scene: ProductionScene = {
      id: `scene-${index + 1}`, order: index + 1, scriptText: fragment, durationSeconds: Math.max(1, endSeconds - cursor),
      startSeconds: cursor, endSeconds, subject, action: "documentary footage", environment: "natural habitat",
      visualIntent: `Illustrate: ${fragment}`, exactSubject: /shark|tiger|whale|species|species|animal|esp[eé]cie/i.test(fragment),
      searchQueries: [
        { language: "en", query: `${querySubject?.[0] || subject} underwater wildlife documentary` },
        { language: "pt-BR", query: `${querySubject?.[1] || subject} vida selvagem subaquática documentário` },
      ], avoidTerms: ["animation", "illustration", "logo", "watermark"], candidates: [], selectedCandidateId: null,
      trimInSeconds: 0, trimOutSeconds: null, titleText: "", status: "waiting",
    };
    cursor = endSeconds;
    return sceneSchema.parse(scene);
  });
}

export function rankCandidate(input: {
  scene: { subject: string; action: string; environment: string; exactSubject: boolean };
  candidate: { title: string; tags: string[]; description: string };
}): { score: number; confidence: "low" | "medium" | "high"; justification: string; exactSubjectVerified: boolean } {
  const subjectTerms = words(input.scene.subject);
  const actionTerms = words(input.scene.action);
  const environmentTerms = words(input.scene.environment);
  const title = words(input.candidate.title).join(" ");
  const tags = new Set(input.candidate.tags.flatMap(words));
  const description = new Set(words(input.candidate.description));
  const hits = (terms: string[], source: string[] | Set<string>) => terms.filter((term) => source instanceof Set ? source.has(term) : source.includes(term)).length / Math.max(terms.length, 1);
  const titleSubject = hits(subjectTerms, title.split(" "));
  const tagSubject = hits(subjectTerms, tags);
  const descriptionSubject = hits(subjectTerms, description);
  const subject = Math.max(titleSubject, tagSubject, descriptionSubject * 0.7);
  const action = Math.max(hits(actionTerms, tags), hits(actionTerms, description)) * 0.2;
  const setting = Math.max(hits(environmentTerms, tags), hits(environmentTerms, description)) * 0.15;
  const score = Math.min(1, Number((subject * 0.65 + action + setting + (titleSubject === 1 ? 0.15 : 0)).toFixed(2)));
  const exactSubjectVerified = !input.scene.exactSubject || (titleSubject === 1 && (tagSubject > 0 || descriptionSubject > 0));
  const confidence = score >= 0.65 && exactSubjectVerified ? "high" : score >= 0.35 ? "medium" : "low";
  return { score, confidence, exactSubjectVerified, justification: confidence === "low" ? "Correspondência textual fraca; confirme o conteúdo visual antes de usar." : `Termos coincidentes no título, tags e descrição (pontuação ${score.toFixed(2)}).` };
}

const transitions: Record<JobStatus, JobStatus[]> = {
  waiting: ["processing", "error", "cancelled"], processing: ["completed", "error", "waiting", "cancelled"], error: ["waiting"], completed: [], cancelled: [],
};
export function transitionJob(from: JobStatus, to: JobStatus): { status: JobStatus; progress: number } {
  if (!transitions[from].includes(to)) throw new Error(`Transição de job inválida: ${from} → ${to}`);
  return { status: to, progress: to === "completed" ? 100 : to === "processing" ? 1 : 0 };
}

export function productionProjectWhere(id: string, userId: string) { return { id, userId }; }

export type VisualElement = { id: string; type: "title" | "callout" | "caption" | "subtitle"; start: number; end: number; text: string; priority?: number };
export function resolveOverlappingVisuals(elements: VisualElement[], priorities: PriorityConfig = ELEMENT_PRIORITIES) {
  return winningVisualIntervals(elements, priorities);
}
