import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildScenesFromScript } from "@/lib/production/models";
import { criarProvider } from "@/lib/roteiro/provider-server";
import { resolverChaveDoUsuario } from "@/lib/credentials/store";
import { AUDIO_MIX_DEFAULTS } from "@/lib/production/catalog";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200), brief: z.string().trim().max(10000).optional(),
  script: z.string().max(100000).optional(), language: z.string().max(40).default("pt-BR"),
  targetSeconds: z.number().int().min(30).max(7200).default(600), aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  resolution: z.enum(["720", "1080"]).default("1080"),
  style: z.enum(["broadcast", "cinema", "dossie", "kinetico"]).default("dossie"), provider: z.enum(["fake", "gemini", "openai"]).default("openai"),
}).refine((data) => Boolean(data.brief || data.script?.trim()), { message: "Informe um briefing ou cole um roteiro." });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const projects = await prisma.productionProject.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, language: true, status: true, stage: true, updatedAt: true, lastError: true } });
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confira o título, briefing e opções do projeto." }, { status: 400 });
  const data = parsed.data;
  const brief = data.brief?.trim() || data.script?.trim().slice(0, 2000) || data.title;
  let script = data.script?.trim() ?? "";
  if (!script) {
    if (data.provider === "fake") return NextResponse.json({ error: "Sem IA, informe um roteiro pronto. O provider de demonstração não é usado como narração real." }, { status: 400 });
    const key = await resolverChaveDoUsuario(data.provider, user);
    try {
      const generated = await criarProvider(data.provider, key).gerar({
        tema: brief,
        idioma: data.language,
        alvoCaracteres: Math.min(data.targetSeconds * 15, 30000),
        promptSistema: "Escreva uma narração documental clara e factual, organizada em parágrafos curtos. Não invente fatos, fontes, espécies ou etimologias; marque [revisar] quando uma afirmação exigir pesquisa. Retorne somente o texto narrado.",
      });
      script = generated.texto;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível gerar o roteiro.";
      return NextResponse.json({ error: message }, { status: /chave.*não informada/i.test(message) ? 401 : 502 });
    }
  }
  const scenes = buildScenesFromScript(script, data.targetSeconds);
  if (!scenes.length) return NextResponse.json({ error: "O roteiro não gerou cenas." }, { status: 400 });
  if (scenes.length > 120) return NextResponse.json({ error: "Este plano tem mais de 120 cenas. Divida o roteiro em projetos menores." }, { status: 400 });
  const project = await prisma.productionProject.create({ data: {
    userId: user.id, title: data.title, brief, script, language: data.language, provider: data.provider,
    targetSeconds: data.targetSeconds, aspectRatio: data.aspectRatio, style: data.style,
    stage: "media", status: "waiting", scenes: scenes as unknown as Prisma.InputJsonValue,
    renderSettings: { width: data.aspectRatio === "16:9" ? Number(data.resolution) * 16 / 9 : Number(data.resolution), height: data.aspectRatio === "9:16" ? Number(data.resolution) * 16 / 9 : Number(data.resolution), fps: 30, audioMix: AUDIO_MIX_DEFAULTS },
  }, select: { id: true, title: true, stage: true, status: true, scenes: true } });
  return NextResponse.json(project, { status: 201 });
}
