import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { Roteiro } from "@/types/roteiro";

export function baixarZIP(roteiros: Roteiro[], somenteTitulo = false) {
  const zip = new JSZip();

  roteiros.forEach((r, idx) => {
    const nomeArquivo = `${idx + 1}.txt`;
    const conteudo = somenteTitulo ? r.titulo : `${r.titulo}\n\n${r.texto}`;
    zip.file(nomeArquivo, conteudo);
  });

  zip.generateAsync({ type: "blob" }).then((content) => {
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = "roteiros.zip";
    link.click();
  });
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
