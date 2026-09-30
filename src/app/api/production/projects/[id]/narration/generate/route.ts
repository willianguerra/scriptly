import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { productionProjectWhere } from "@/lib/production/models";
import { generateWithVoiceStudio, voiceStudioAvailability } from "@/lib/production/voice-provider";

export const runtime = "nodejs";
const root = path.resolve(process.env.MEDIA_STORAGE_DIR || path.join(process.cwd(), "storage", "media"));

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.json(voiceStudioAvailability());
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const project = await prisma.productionProject.findFirst({ where: productionProjectWhere(id, user.id) });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  const body = z.object({ text: z.string().trim().min(1).max(100000), voice: z.string().trim().min(1).max(120) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Informe texto e identificador de voz." }, { status: 400 });
  try {
    const result = await generateWithVoiceStudio({ ...body.data, language: project.language });
    const relativePath = path.join("projects", id, "narration.mp3");
    const absolutePath = path.resolve(root, relativePath);
    if (!absolutePath.startsWith(`${root}${path.sep}`)) throw new Error("Diretório de mídia inválido.");
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, result.audio, { mode: 0o600 });
    await prisma.productionProject.updateMany({ where: productionProjectWhere(id, user.id), data: { narration: { path: relativePath, mimeType: result.mimeType, bytes: result.audio.length, provider: result.provider, voice: body.data.voice }, stage: "edit", status: "waiting", outputPath: null, lastError: null } });
    return NextResponse.json({ ok: true, bytes: result.audio.length, provider: result.provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geração de narração indisponível.";
    return NextResponse.json({ error: message }, { status: /indisponível|configure/.test(message) ? 503 : 502 });
  }
}
