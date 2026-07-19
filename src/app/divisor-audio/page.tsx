import type { Metadata } from "next";
import { AudioSplitter } from "@/components/divisor-audio/audio-splitter";

export const metadata: Metadata = {
  title: "Divisor de Áudio",
  description:
    "Envie ou grave um áudio e divida automaticamente em blocos configuráveis com a transcrição de cada trecho.",
};

export default function DivisorAudioPage() {
  return <AudioSplitter />;
}
