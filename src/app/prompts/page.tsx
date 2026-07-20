import type { Metadata } from "next";
import { BibliotecaPrompts } from "@/components/biblioteca-prompts";

export const metadata: Metadata = {
  title: "Biblioteca de prompts",
  description:
    "Salve e gerencie prompts nomeados para reutilizar na geração de roteiros dos vídeos.",
};

export default function PromptsPage() {
  return <BibliotecaPrompts />;
}
