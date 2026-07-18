
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/server";

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { error: "Autenticação necessária." },
      { status: 401 }
    );
  }

  const { text } = await req.json();
  return NextResponse.json({ text });
}
