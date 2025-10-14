
import { NextResponse } from "next/server";


export async function POST(req: Request) {
  const { text, targetLang } = await req.json();


  const translatedText = text.join("\n\n");
  return NextResponse.json({ text });
}