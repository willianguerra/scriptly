// "@/lib/fileUtils"
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { Roteiro } from "@/types/roteiro";

function safeFilePart(input: string) {
  const s = (input || "").trim();

  const normalized = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos

  const cleaned = normalized
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // remove chars inválidos no Windows
    .replace(/\s+/g, "_") // espaços -> _
    .replace(/_+/g, "_") // colapsa __
    .replace(/^_+|_+$/g, ""); // trim _

  return (cleaned || "sem_titulo").slice(0, 80);
}

export async function baixarZIP(
  roteiros: Roteiro[],
  salvarSomenteTitulo: boolean = false
) {
  const zip = new JSZip();

  roteiros.forEach((r, idx) => {
    const numero = idx + 1;
    const baseName = `${numero}`;

    const tituloTxt = (r.titulo ?? "").trim();
    const roteiroTxt = (r.texto ?? "").trim();

    // 1) sempre gera o TXT do título
    zip.file(`titulo_${baseName}.txt`, tituloTxt);

    // 2) se NÃO for "somente título", gera o TXT do roteiro
    if (!salvarSomenteTitulo) {
      // se quiser, pode pular quando estiver vazio:
      // if (!roteiroTxt) return;
      zip.file(`${baseName}.txt`, roteiroTxt);
    }
  });

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, "roteiros.zip");
}

export const baixarSRT = (conteudo: string) => {
  const blob = new Blob([conteudo], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "legendas.srt";
  a.click();
  URL.revokeObjectURL(url);
};
