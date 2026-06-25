import type { Metadata } from "next";
import { AudioSplitter } from "@/components/divisor-audio/audio-splitter";

export const metadata: Metadata = {
  title: "Divisor de Áudio",
  description:
    "Envie ou grave um áudio e divida automaticamente em blocos de 8 segundos com a transcrição de cada trecho.",
};

export default function DivisorAudioPage() {
  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <AudioSplitter />
    </div>
  );
}
