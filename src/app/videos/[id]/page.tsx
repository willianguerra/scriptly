import { VideoShell } from "@/components/videos/video-shell";

export default async function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VideoShell id={id} />;
}
