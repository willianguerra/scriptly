export async function readBodyAtMost(request: Request, limit: number): Promise<Buffer> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > limit) throw new Error("BODY_TOO_LARGE");
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new Error("BODY_TOO_LARGE");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export function audioExtensionForMime(mimeType: string): string {
  if (/^audio\/(wav|x-wav|wave)$/i.test(mimeType)) return "wav";
  if (/^audio\/(mp4|x-m4a)$/i.test(mimeType)) return "m4a";
  if (/^audio\/aac$/i.test(mimeType)) return "aac";
  if (/^audio\/ogg$/i.test(mimeType)) return "ogg";
  if (/^audio\/webm$/i.test(mimeType)) return "webm";
  return "mp3";
}
