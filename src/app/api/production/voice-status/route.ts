import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { voiceStudioAvailability } from "@/lib/production/voice-provider";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  return NextResponse.json(voiceStudioAvailability());
}
