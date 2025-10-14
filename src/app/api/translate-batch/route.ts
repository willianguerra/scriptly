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
function splitTextSmart(text: string, maxChunkSize = 2500): string[] {
  const chunks: string[] = [];
  let current = "";

  const sentences = text.split(/(?<=[.!?])\s+/); // divide no final de frases

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if ((current + " " + trimmed).length > maxChunkSize) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current += (current ? " " : "") + trimmed;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Tenta traduzir um chunk usando múltiplos servidores
 */
async function translateChunkWithFallback(chunk: string, targetLang: string) {
  for (const server of SERVERS) {
    try {
      const res = await axios.post(
        server,
        {
          q: chunk,
          source: "auto",
          target: targetLang,
          format: "text",
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 60000,
        }
      );
      return res.data.translatedText;
    } catch (error: any) {
      console.warn(`⚠️ Falha no servidor ${server}:`, error.response?.data || error.message);
    }
  }
  // Se todos falharem:
  throw new Error("Nenhum servidor de tradução disponível.");
}

export async function POST(req: Request) {
  const { text, targetLang } = await req.json();

  const chunks = splitTextSmart(text);
  const translatedChunks: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      const translated = await translateChunkWithFallback(chunks[i], targetLang);
      translatedChunks.push(translated);
    } catch (error) {
      console.error(`❌ Erro ao traduzir chunk ${i + 1}/${chunks.length}:`, error);
      translatedChunks.push(`[ERRO ao traduzir trecho ${i + 1}]`);
    }
  }

  const translatedText = translatedChunks.join("\n\n");
  return NextResponse.json({ translatedText, totalChunks: chunks.length });
}
