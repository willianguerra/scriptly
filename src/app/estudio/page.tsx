import { redirect } from "next/navigation";

// O Estúdio avulso foi aposentado: o fluxo (roteiro → narração → sincronização →
// prompts de cena) agora vive dentro de cada vídeo, em /canais → vídeo.
export default function EstudioPage() {
  redirect("/");
}
