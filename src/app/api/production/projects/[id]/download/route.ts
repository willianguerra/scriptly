import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { productionProjectWhere } from "@/lib/production/models";

export const runtime = "nodejs";
const root = path.resolve(process.env.MEDIA_STORAGE_DIR || path.join(process.cwd(), "storage", "media"));

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const project = await prisma.productionProject.findFirst({ where: productionProjectWhere(id, user.id), select: { outputPath: true, status: true, title: true } });
  if (!project || project.status !== "completed" || !project.outputPath) return NextResponse.json({ error: "Exportação não encontrada." }, { status: 404 });
  const file = path.resolve(root, project.outputPath);
  if (!file.startsWith(`${root}${path.sep}`)) return NextResponse.json({ error: "Caminho de exportação inválido." }, { status: 404 });
  try {
    const info = await stat(file);
    const preview = new URL(request.url).searchParams.get("preview") === "1";
    const downloadName = `${project.title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80) || "scriptly-export"}.mp4`;
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
      const suffixLength = match[1] ? null : Number(match[2]);
      const start = match[1] ? Number(match[1]) : Math.max(0, info.size - (suffixLength || 0));
      const end = match[1] ? Math.min(Number(match[2]) || info.size - 1, info.size - 1) : info.size - 1;
      if (start >= info.size || end < start) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
      const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
      return new Response(stream, { status: 206, headers: { "Content-Type": "video/mp4", "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${info.size}`, "Accept-Ranges": "bytes", "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${downloadName}"`, "Cache-Control": "private, no-store" } });
    }
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    return new Response(stream, { headers: { "Content-Type": "video/mp4", "Content-Length": String(info.size), "Accept-Ranges": "bytes", "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${downloadName}"`, "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "O arquivo exportado não está disponível no armazenamento configurado." }, { status: 404 });
  }
}
