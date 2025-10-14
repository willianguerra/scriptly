import axios from "axios";
import { NextResponse } from "next/server";

const SERVERS = [
  "https://libretranslate-rm2k.onrender.com/translate",
  "https://translate.astian.org/translate",
  "https://translate.argosopentech.com/translate",
  "https://libretranslate.com/translate",
];

/**
 * Divide o texto em blocos no final de frases, respeitando limite de tamanho.
 */


export async function POST(req: Request) {
  const { text, targetLang } = await req.json();


  const translatedText = text.join("\n\n");
  return NextResponse.json({ text });
}