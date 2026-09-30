import { clipCandidateSchema, type ClipCandidate } from "./models.ts";

type PexelsFile = { width: number; height: number; link: string; file_type?: string };
type PexelsVideo = {
  id: number; url: string; image: string; duration: number; video_files: PexelsFile[];
  user: { name: string; url: string }; video_pictures?: { picture: string }[];
};
type Fetcher = (url: URL, init: RequestInit) => Promise<Response>;

export function isAuthorizedPexelsDownload(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "videos.pexels.com" && url.pathname.startsWith("/video-files/");
  } catch { return false; }
}

export async function searchPexelsVideos(query: string, apiKey: string, fetcher: Fetcher = fetch, locale = "en-US"): Promise<ClipCandidate[]> {
  if (!apiKey.trim()) throw new Error("PEXELS_API_KEY não está configurada no servidor. Adicione a chave Pexels no ambiente para pesquisar vídeos.");
  const url = new URL("https://api.pexels.com/v1/videos/search");
  url.searchParams.set("query", query.slice(0, 180));
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("per_page", "12");
  url.searchParams.set("locale", locale === "pt-BR" ? "pt-BR" : "en-US");
  const response = await fetcher(url, { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!response.ok) throw new Error(`Pexels respondeu HTTP ${response.status}.`);
  const payload = await response.json() as { videos?: PexelsVideo[] };
  return (payload.videos ?? []).flatMap((video) => {
    const file = [...(video.video_files ?? [])].filter((f) => f.file_type?.includes("mp4") && f.width >= 640).sort((a, b) => b.width - a.width)[0];
    if (!file || !isAuthorizedPexelsDownload(file.link)) return [];
    const creatorName = video.user?.name || "Pexels creator";
    const sourceUrl = video.url.startsWith("https://www.pexels.com/") ? video.url : "https://www.pexels.com/videos/";
    const title = `Pexels video ${video.id}`;
    return [clipCandidateSchema.parse({
      id: `pexels-${video.id}`, provider: "pexels", sourceUrl,
      previewUrl: video.video_pictures?.[0]?.picture ?? video.image, downloadUrl: file.link, title,
      creator: creatorName, creatorUrl: /^https:\/\/www\.pexels\.com\//.test(video.user?.url || "") ? video.user.url : null,
      license: "Pexels License", licenseUrl: "https://www.pexels.com/license/", attribution: `Video by ${creatorName} via Pexels`,
      durationSeconds: video.duration, width: file.width, height: file.height, tags: [], score: 0.1, confidence: "low",
      justification: "Pexels não fornece evidência semântica detalhada para este clipe; confira a prévia antes de afirmar sujeito ou ação.", exactSubjectVerified: false,
    })];
  }).sort((a, b) => b.score - a.score).slice(0, 8);
}
