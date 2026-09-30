import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { productionProjectWhere } from "@/lib/production/models";
import { audioExtensionForMime, readBodyAtMost } from "@/lib/production/body-limit";

export const runtime = "nodejs";
const root = path.resolve(process.env.MEDIA_STORAGE_DIR || path.join(process.cwd(), "storage", "media"));

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const project = await prisma.productionProject.findFirst({ where: productionProjectWhere(id, user.id), select: { music: true, effects: true } });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  const kind = request.headers.get("x-audio-kind");
  if (kind !== "music" && kind !== "effect") return NextResponse.json({ error: "Tipo de faixa inválido." }, { status: 400 });
  const type = request.headers.get("content-type")?.split(";")[0] || "";
  if (!/^audio\/(mpeg|mp3|wav|x-wav|wave|ogg|webm|mp4|x-m4a|aac)$/i.test(type)) return NextResponse.json({ error: "Envie um arquivo de áudio MP3, WAV, M4A, AAC, OGG ou WebM." }, { status: 415 });
  const startSeconds = Number(request.headers.get("x-start-seconds") || 0);
  if (!Number.isFinite(startSeconds) || startSeconds < 0 || startSeconds > 7200) return NextResponse.json({ error: "Entrada da faixa entre 0 e 7200 segundos." }, { status: 400 });
  let bytes: Buffer;
  try { bytes = await readBodyAtMost(request, 80 * 1024 * 1024); }
  catch { return NextResponse.json({ error: "Áudio acima do limite de 80 MB." }, { status: 413 }); }
  if (!bytes.length) return NextResponse.json({ error: "Áudio vazio." }, { status: 400 });
  const extension = audioExtensionForMime(type);
  const basename = kind === "music" ? `music.${extension}` : `effect.${extension}`;
  const relativePath = path.join("projects", id, basename);
  const absolutePath = path.resolve(root, relativePath);
  if (!absolutePath.startsWith(`${root}${path.sep}`)) return NextResponse.json({ error: "Caminho inválido." }, { status: 400 });
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes, { mode: 0o600 });
  const track = { path: relativePath, mimeType: type, bytes: bytes.length, title: (request.headers.get("x-audio-title") || "Faixa enviada").slice(0, 120), license: (request.headers.get("x-audio-license") || "Informada pelo usuário").slice(0, 500), attribution: (request.headers.get("x-audio-attribution") || "").slice(0, 500), startSeconds };
  await prisma.productionProject.updateMany({ where: productionProjectWhere(id, user.id), data: { ...(kind === "music" ? { music: track } : { effects: [track] }), status: "waiting", stage: "edit", outputPath: null, lastError: null } });
  return NextResponse.json({ ok: true, kind, track: { title: track.title, license: track.license, attribution: track.attribution, startSeconds } });
}
