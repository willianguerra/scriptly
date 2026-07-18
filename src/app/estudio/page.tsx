import type { Metadata } from "next";
import { Estudio } from "@/components/estudio";

export const metadata: Metadata = {
  title: "Estúdio",
  description:
    "Gere o roteiro com IA (Gemini ou GPT), sintetize a narração na Darkvi e sincronize o texto ao áudio em legenda SRT e timings.json.",
};

export default function EstudioPage() {
  return <Estudio />;
}
