import { NextResponse } from "next/server";
import { DARKVI_BASE_URL, missingTokenResponse, resolverTokenDarkvi } from "@/lib/darkvi-server";

// GET /api/darkvi/voices -> proxy para GET https://darkvi.com/api/tts/voices
export async function GET() {
  const token = await resolverTokenDarkvi();
  if (!token) return missingTokenResponse();

  try {
    const res = await fetch(`${DARKVI_BASE_URL}/tts/voices`, {
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
