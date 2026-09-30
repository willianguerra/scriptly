import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { productionProjectWhere, sceneListSchema } from "@/lib/production/models";
import { searchPexels } from "@/lib/production/media-provider";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const project = await prisma.productionProject.findFirst({ where: productionProjectWhere(id, user.id) });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  const body = z.object({ sceneId: z.string(), query: z.string().trim().min(2).max(180).optional() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Cena inválida." }, { status: 400 });
  const parsedScenes = sceneListSchema.safeParse(project.scenes);
  if (!parsedScenes.success) return NextResponse.json({ error: "O plano de cenas salvo está inválido." }, { status: 409 });
  const sceneIndex = parsedScenes.data.findIndex((scene) => scene.id === body.data.sceneId);
  if (sceneIndex < 0) return NextResponse.json({ error: "Cena não encontrada." }, { status: 404 });
  const scene = parsedScenes.data[sceneIndex];
  try {
    const queries = [
      { locale: "en-US", query: body.data.query ?? scene.searchQueries.find((item) => item.language === "en")?.query ?? scene.subject },
      ...scene.searchQueries.filter((item) => item.language === "pt-BR").map((item) => ({ locale: "pt-BR", query: item.query })),
    ].slice(0, 2);
    const results = await Promise.all(queries.map((item) => searchPexels(item.query, item.locale)));
    const candidates = [...new Map(results.flat().map((candidate) => [candidate.id, candidate])).values()].slice(0, 8);
    const scenes = parsedScenes.data.map((current, index) => index === sceneIndex ? { ...current, candidates, status: candidates.length ? "ready" as const : "waiting" as const } : current);
    await prisma.productionProject.updateMany({ where: productionProjectWhere(id, user.id), data: { scenes: scenes as unknown as Prisma.InputJsonValue, stage: "selection" } });
    return NextResponse.json({ sceneId: scene.id, candidates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao pesquisar mídia.";
    await prisma.productionProject.updateMany({ where: productionProjectWhere(id, user.id), data: { lastError: message, stage: "media" } });
    return NextResponse.json({ error: message }, { status: /PEXELS_API_KEY/.test(message) ? 503 : 502 });
  }
}
