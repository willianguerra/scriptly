import { NextResponse } from "next/server";
import { DARKVI_BASE_URL, missingTokenResponse, resolverTokenDarkvi } from "@/lib/darkvi-server";

// GET /api/darkvi/audios/:id -> proxy para GET https://darkvi.com/api/tts/audios/:id
// Retorna o binário MP3 (audio/mpeg).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await resolverTokenDarkvi();
  if (!token) return missingTokenResponse();

  const { id } = await params;

  try {
    const res = await fetch(`${DARKVI_BASE_URL}/tts/audios/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({
        ok: false,
        error: true,
        code: "AUDIO_ERROR",
        message: "Falha ao baixar o áudio.",
      }));
      return NextResponse.json(data, { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: true, code: "UPSTREAM_ERROR", message: "Falha ao contatar a Darkvi." },
      { status: 502 }
    );
  }
}
