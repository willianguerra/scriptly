import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { Roteiro } from "@/types/roteiro";

export const baixarZIP = async (roteiros: Roteiro[]) => {
  const zip = new JSZip();
  roteiros.forEach((r, index) => {
    const numero = index + 1;
    const titulo = r.titulo.trim() || `Roteiro ${numero}`;
    const conteudo = `${titulo}\n\n${r.texto.trim()}`;
    zip.file(`${numero}.txt`, conteudo);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, "roteiros.zip");
};

export const baixarSRT = (conteudo: string) => {
  const blob = new Blob([conteudo], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "legendas.srt";
  a.click();
  URL.revokeObjectURL(url);
};
