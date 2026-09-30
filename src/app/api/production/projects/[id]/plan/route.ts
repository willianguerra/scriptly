import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { productionProjectWhere } from "@/lib/production/models";
import { parseStructuredScenePlan } from "@/lib/production/planner";
import { criarProvider, ehProviderValido } from "@/lib/roteiro/provider-server";
import { resolverChaveDoUsuario } from "@/lib/credentials/store";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const project = await prisma.productionProject.findFirst({ where: productionProjectWhere(id, user.id) });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  const body = z.object({ provider: z.string().optional() }).safeParse(await request.json().catch(() => ({})));
  const provider = body.success && body.data.provider ? body.data.provider : project.provider;
  if (!ehProviderValido(provider) || provider === "fake") return NextResponse.json({ error: "Escolha OpenAI ou Gemini para planejar cenas com IA." }, { status: 400 });
  const key = await resolverChaveDoUsuario(provider, user);
  try {
    const result = await criarProvider(provider, key).gerar({
      tema: `PLANO DE CENAS PARA O ROTEIRO ABAIXO. Use cada trecho como narração literal e não acrescente fatos.\n\n${project.script}`,
      idioma: project.language, alvoCaracteres: Math.min(project.script.length * 2 + 2500, 24000),
      promptSistema: `Converta o roteiro em um plano editorial JSON. Retorne SOMENTE um objeto JSON no formato {"scenes":[...]}. Cada cena requer scriptText (trecho literal do roteiro), durationSeconds, subject, action, environment, visualIntent, exactSubject (boolean: verdadeiro só quando o texto exige o sujeito exato), searchQueries (pelo menos duas consultas com language en e pt-BR), avoidTerms (array), titleText. Preserve espécies e nomes; não invente evidência visual. As consultas servem para procurar material licenciado, não afirmam que um resultado mostre a ação. Divida em no máximo 120 cenas. Não gere roteiro novo e não inclua markdown.`,
    });
    const scenes = parseStructuredScenePlan(result.texto);
    await prisma.productionProject.updateMany({ where: productionProjectWhere(id, user.id), data: { scenes: scenes as unknown as Prisma.InputJsonValue, provider, stage: "selection", status: "waiting", outputPath: null, lastError: null } });
    return NextResponse.json({ scenes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao planejar cenas.";
    await prisma.productionProject.updateMany({ where: productionProjectWhere(id, user.id), data: { lastError: message } });
    return NextResponse.json({ error: message }, { status: /não informada/i.test(message) ? 401 : 502 });
  }
}
