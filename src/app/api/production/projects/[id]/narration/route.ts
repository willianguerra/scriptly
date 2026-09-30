import { NextResponse } from "next/server";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { productionProjectWhere } from "@/lib/production/models";
import { audioExtensionForMime, readBodyAtMost } from "@/lib/production/body-limit";

export const runtime = "nodejs";
const storageRoot = path.resolve(process.env.MEDIA_STORAGE_DIR || path.join(process.cwd(), "storage", "media"));

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const project = await prisma.productionProject.findFirst({ where: productionProjectWhere(id, user.id), select: { narration: true } });
  if (!project?.narration || typeof project.narration !== "object" || Array.isArray(project.narration)) return NextResponse.json({ error: "Áudio de narração não encontrado." }, { status: 404 });
  const metadata = project.narration as { path?: unknown; mimeType?: unknown };
  if (typeof metadata.path !== "string") return NextResponse.json({ error: "Caminho de narração inválido." }, { status: 404 });
  const file = path.resolve(storageRoot, metadata.path);
  if (!file.startsWith(`${storageRoot}${path.sep}`)) return NextResponse.json({ error: "Caminho de narração inválido." }, { status: 404 });
  try {
    const info = await stat(file);
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    return new Response(stream, { headers: { "Content-Type": typeof metadata.mimeType === "string" ? metadata.mimeType : "audio/mpeg", "Content-Length": String(info.size), "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Arquivo de narração não está disponível." }, { status: 404 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const project = await prisma.productionProject.findFirst({ where: productionProjectWhere(id, user.id), select: { id: true } });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  const type = request.headers.get("content-type")?.split(";")[0] ?? "";
  if (!/^audio\/(mpeg|mp3|wav|x-wav|wave|ogg|webm|mp4|x-m4a|aac)$/i.test(type)) return NextResponse.json({ error: "Envie um arquivo de áudio MP3, WAV, M4A, AAC, OGG ou WebM." }, { status: 415 });
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > 80 * 1024 * 1024) return NextResponse.json({ error: "Áudio maior que 80 MB." }, { status: 413 });
  let bytes: Buffer;
  try { bytes = await readBodyAtMost(request, 80 * 1024 * 1024); }
  catch { return NextResponse.json({ error: "Arquivo de áudio maior que 80 MB." }, { status: 413 }); }
  if (!bytes.length) return NextResponse.json({ error: "Arquivo de áudio vazio." }, { status: 400 });
  const extension = audioExtensionForMime(type);
  const relativePath = path.join("projects", id, `narration.${extension}`);
  const absolutePath = path.resolve(storageRoot, relativePath);
  if (!absolutePath.startsWith(`${storageRoot}${path.sep}`)) return NextResponse.json({ error: "Caminho inválido." }, { status: 400 });
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes, { mode: 0o600 });
  await prisma.productionProject.updateMany({ where: productionProjectWhere(id, user.id), data: { narration: { path: relativePath, mimeType: type, bytes: bytes.length, source: "user-or-tts" }, stage: "edit", status: "waiting", outputPath: null, lastError: null } });
  return NextResponse.json({ ok: true, bytes: bytes.length });
}
