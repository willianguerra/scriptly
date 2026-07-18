import { NextResponse } from "next/server";
import { DARKVI_BASE_URL, missingTokenResponse, resolveToken } from "@/lib/darkvi-server";

// GET /api/darkvi/tts/:id -> proxy para GET https://darkvi.com/api/tts/:id (status)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = resolveToken(req);
  if (!token) return missingTokenResponse();

  const { id } = await params;

  try {
    const res = await fetch(`${DARKVI_BASE_URL}/tts/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
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
