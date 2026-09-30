import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { productionProjectWhere, sceneListSchema } from "@/lib/production/models";

export const runtime = "nodejs";
const updateSchema = z.object({ title: z.string().trim().min(1).max(200).optional(), script: z.string().max(100000).optional(), scenes: sceneListSchema.optional(), language: z.string().max(40).optional(), subtitles: z.string().max(500000).nullable().optional(), renderSettings: z.object({ audioMix: z.object({ narrationVolume: z.number().min(0).max(2), musicVolume: z.number().min(0).max(2), effectsVolume: z.number().min(0).max(2), ducking: z.number().min(0).max(1) }) }).optional() });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const project = await prisma.productionProject.findFirst({ where: productionProjectWhere(id, user.id), include: { jobs: { orderBy: { createdAt: "desc" }, take: 5 } } });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const data: Prisma.ProductionProjectUpdateManyMutationInput = { ...parsed.data, ...(Object.keys(parsed.data).length ? { ...(parsed.data.scenes ? { scenes: parsed.data.scenes as unknown as Prisma.InputJsonValue } : {}), stage: "edit", status: "waiting", outputPath: null, lastError: null } : {}) };
  if (parsed.data.renderSettings) {
    const existing = await prisma.productionProject.findFirst({ where: productionProjectWhere(id, user.id), select: { renderSettings: true } });
    if (!existing) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    const previous = existing.renderSettings && typeof existing.renderSettings === "object" && !Array.isArray(existing.renderSettings) ? existing.renderSettings as Record<string, unknown> : {};
    data.renderSettings = { ...previous, ...parsed.data.renderSettings } as Prisma.InputJsonValue;
  }
  const result = await prisma.productionProject.updateMany({ where: productionProjectWhere(id, user.id), data });
  if (!result.count) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  return GET(request, { params });
}
