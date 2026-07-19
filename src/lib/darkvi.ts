// Cliente (browser) para a integração Darkvi.
// Fala com os proxies em /api/darkvi/*. A chave NÃO trafega mais pelo cliente:
// o servidor resolve a chave do usuário logado (guardada criptografada no
// banco). A chave é gerenciada na tela de Configurações via /api/credentials.

import type {
  DarkviCreateResponse,
  DarkviTextSpeech,
  DarkviVoice,
} from "@/types/darkvi";

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.message || data?.code || `Erro ${res.status}`;
}

// GET /api/darkvi/voices
export async function listarVozes(): Promise<DarkviVoice[]> {
  const res = await fetch("/api/darkvi/voices");
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return Array.isArray(data) ? (data as DarkviVoice[]) : [];
}

// POST /api/darkvi/tts -> retorna o id do textspeech criado
export async function criarAudio(params: {
  text: string;
  voice: string;
  title?: string;
}): Promise<string> {
  const res = await fetch("/api/darkvi/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data: DarkviCreateResponse = await res.json();
  const id = data?.data?.created?.id;
  if (!id) throw new Error("A Darkvi não retornou o id do áudio.");
  return id;
}

// GET /api/darkvi/tts/:id -> status atual
export async function consultarStatus(id: string): Promise<DarkviTextSpeech> {
  const res = await fetch(`/api/darkvi/tts/${id}`);
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

// Faz polling até status DONE (ou ERROR / timeout).
export async function aguardarConclusao(
  id: string,
  opts: { intervaloMs?: number; tentativas?: number } = {}
): Promise<DarkviTextSpeech> {
  const intervalo = opts.intervaloMs ?? 4000;
  const maxTentativas = opts.tentativas ?? 60; // ~4 min
  for (let i = 0; i < maxTentativas; i++) {
    const info = await consultarStatus(id);
    if (info.status === "DONE") return info;
    if (info.status === "ERROR") throw new Error("A Darkvi retornou status ERROR para o áudio.");
    await new Promise((r) => setTimeout(r, intervalo));
  }
  throw new Error("Tempo esgotado aguardando a geração do áudio.");
}

// GET /api/darkvi/audios/:id -> Blob do MP3
export async function baixarAudioBlob(id: string): Promise<Blob> {
  const res = await fetch(`/api/darkvi/audios/${id}`);
  if (!res.ok) throw new Error(await readError(res));
  return res.blob();
}
