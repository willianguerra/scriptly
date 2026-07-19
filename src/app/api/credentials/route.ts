import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { ehCredentialProvider } from "@/lib/credentials/providers";
import {
  removerCredencial,
  salvarCredencial,
  statusCredenciais,
} from "@/lib/credentials/store";

export const runtime = "nodejs";

// GET /api/credentials -> situação das chaves do usuário logado (mascaradas).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  return NextResponse.json(await statusCredenciais(user));
}

const putSchema = z.object({
  provider: z.string(),
  key: z.string().trim().min(1, "Informe a chave.").max(500),
});

// PUT /api/credentials -> salva/atualiza a chave de um provider do usuário.
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success || !ehCredentialProvider(parsed.data.provider)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await salvarCredencial(user.id, parsed.data.provider, parsed.data.key);
  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({ provider: z.string() });

// DELETE /api/credentials -> remove a chave de um provider do usuário.
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success || !ehCredentialProvider(parsed.data.provider)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await removerCredencial(user.id, parsed.data.provider);
  return NextResponse.json({ ok: true });
}
