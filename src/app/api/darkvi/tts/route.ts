import { NextResponse } from "next/server";
import { DARKVI_BASE_URL, missingTokenResponse, resolverTokenDarkvi } from "@/lib/darkvi-server";

// POST /api/darkvi/tts -> proxy para POST https://darkvi.com/api/tts
// body: { text: string, voice: string, title?: string }
export async function POST(req: Request) {
  const token = await resolverTokenDarkvi();
  if (!token) return missingTokenResponse();

  const body = await req.json().catch(() => null);
  if (!body?.text || !body?.voice) {
    return NextResponse.json(
      { ok: false, error: true, code: "INVALID_BODY", message: "Campos 'text' e 'voice' são obrigatórios." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${DARKVI_BASE_URL}/tts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: body.text,
        voice: body.voice,
        ...(body.title ? { title: body.title } : {}),
      }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? { ok: false, error: true }, { status: res.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: true, code: "UPSTREAM_ERROR", message: "Falha ao contatar a Darkvi." },
      { status: 502 }
    );
  }
}
