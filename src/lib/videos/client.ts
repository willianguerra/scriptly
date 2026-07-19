// Cliente (browser) dos vídeos, persistidos via /api/channels/:id/videos e
// /api/videos/:id. Espelha o padrão de src/lib/channels/client.ts.

import type { VideoSalvo } from "@/types/video";

export interface DadosVideoUpdate {
  titulo?: string;
  tema?: string | null;
  scheduledAt?: string | null;
  promptSistema?: string | null;
  provider?: string | null;
  roteiro?: string | null;
  voz?: string | null;
  segmentos?: unknown;
  timings?: unknown;
  srt?: string | null;
  notas?: string | null;
}

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error || `Erro ${res.status}`;
}

export async function listarVideos(channelId: string): Promise<VideoSalvo[]> {
  const res = await fetch(`/api/channels/${channelId}/videos`);
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return Array.isArray(data) ? (data as VideoSalvo[]) : [];
}

export async function criarVideo(
  channelId: string,
  dados: { titulo: string; tema?: string }
): Promise<VideoSalvo> {
  const res = await fetch(`/api/channels/${channelId}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function obterVideo(id: string): Promise<VideoSalvo> {
  const res = await fetch(`/api/videos/${id}`);
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function atualizarVideo(
  id: string,
  dados: DadosVideoUpdate
): Promise<VideoSalvo> {
  const res = await fetch(`/api/videos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function excluirVideo(id: string): Promise<void> {
  const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res));
}
