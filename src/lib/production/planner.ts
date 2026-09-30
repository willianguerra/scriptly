import { z } from "zod";
import { sceneSchema, type ProductionScene } from "./models.ts";

const planItemSchema = z.object({
  scriptText: z.string().trim().min(1).max(5000), durationSeconds: z.number().positive().max(600),
  subject: z.string().trim().min(1).max(300), action: z.string().trim().min(1).max(300),
  environment: z.string().trim().min(1).max(300), visualIntent: z.string().trim().min(1).max(500), exactSubject: z.boolean(),
  searchQueries: z.array(z.object({ language: z.string().min(2).max(20), query: z.string().trim().min(2).max(180) })).min(2).max(5),
  avoidTerms: z.array(z.string().trim().min(1).max(100)).max(20).default([]), titleText: z.string().max(200).default(""),
});
const planSchema = z.object({ scenes: z.array(planItemSchema).min(1).max(120) });

export function parseStructuredScenePlan(response: string): ProductionScene[] {
  const fenced = response.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const start = (fenced ?? response).indexOf("{");
  const end = (fenced ?? response).lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("A IA não retornou um plano JSON de cenas válido. Tente novamente ou ajuste o roteiro.");
  let parsed: unknown;
  try { parsed = JSON.parse((fenced ?? response).slice(start, end + 1)); }
  catch { throw new Error("O plano de cenas gerado não contém JSON legível. Tente novamente."); }
  const input = planSchema.parse(parsed);
  let cursor = 0;
  return input.scenes.map((scene, index) => {
    const startSeconds = cursor;
    cursor += scene.durationSeconds;
    return sceneSchema.parse({ ...scene, id: `scene-${index + 1}`, order: index + 1, startSeconds, endSeconds: cursor,
      candidates: [], selectedCandidateId: null, trimInSeconds: 0, trimOutSeconds: null, status: "waiting" });
  });
}
