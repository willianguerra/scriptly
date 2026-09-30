import "server-only";
import { searchPexelsVideos } from "./pexels-adapter";

export async function searchPexels(query: string, locale = "en-US") {
  const key = process.env.PEXELS_API_KEY?.trim() || "";
  return searchPexelsVideos(query, key, fetch, locale);
}
