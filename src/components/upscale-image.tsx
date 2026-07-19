"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, ImageUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";

const THUMB_WIDTH = 1280;
const THUMB_HEIGHT = 720;

type FitMode = "cover" | "contain";

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Falha ao carregar imagem"));
    };
    image.src = url;
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UpscaleImage() {
  const [file, setFile] = React.useState<File | null>(null);
  const [fitMode, setFitMode] = React.useState<FitMode>("cover");
  const [previewInputUrl, setPreviewInputUrl] = React.useState<string>("");
  const [previewOutputUrl, setPreviewOutputUrl] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [sizeText, setSizeText] = React.useState("");

  React.useEffect(() => {
    return () => {
      if (previewInputUrl) URL.revokeObjectURL(previewInputUrl);
      if (previewOutputUrl) URL.revokeObjectURL(previewOutputUrl);
    };
  }, [previewInputUrl, previewOutputUrl]);

  async function handleGenerate() {
    if (!file) return;
    setIsProcessing(true);

    try {
      const image = await loadImageFromFile(file);

      const canvas = document.createElement("canvas");
      canvas.width = THUMB_WIDTH;
      canvas.height = THUMB_HEIGHT;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas nao suportado");

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const sourceRatio = image.width / image.height;
      const targetRatio = THUMB_WIDTH / THUMB_HEIGHT;

      if (fitMode === "cover") {
        // Preenche todo o quadro 16:9 cortando o excesso (sem bordas).
        let drawWidth = THUMB_WIDTH;
        let drawHeight = THUMB_HEIGHT;
        if (sourceRatio > targetRatio) {
          drawWidth = THUMB_HEIGHT * sourceRatio;
        } else {
          drawHeight = THUMB_WIDTH / sourceRatio;
        }
        const offsetX = (THUMB_WIDTH - drawWidth) / 2;
        const offsetY = (THUMB_HEIGHT - drawHeight) / 2;
        context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
      } else {
        // Ajusta a imagem inteira dentro do quadro 16:9 (com bordas pretas).
        context.fillStyle = "#000000";
        context.fillRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);

        let drawWidth = THUMB_WIDTH;
        let drawHeight = THUMB_HEIGHT;
        if (sourceRatio > targetRatio) {
          drawHeight = THUMB_WIDTH / sourceRatio;
        } else {
          drawWidth = THUMB_HEIGHT * sourceRatio;
        }
        const offsetX = (THUMB_WIDTH - drawWidth) / 2;
        const offsetY = (THUMB_HEIGHT - drawHeight) / 2;
        context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((createdBlob) => resolve(createdBlob), "image/jpeg", 0.92);
      });

      if (!blob) throw new Error("Falha ao gerar imagem final");

      if (previewOutputUrl) URL.revokeObjectURL(previewOutputUrl);
      const outputUrl = URL.createObjectURL(blob);
      setPreviewOutputUrl(outputUrl);
      setSizeText(
        `${image.width}x${image.height} -> ${THUMB_WIDTH}x${THUMB_HEIGHT} (${formatBytes(blob.size)})`
      );
    } finally {
      setIsProcessing(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setPreviewOutputUrl("");
    setSizeText("");

    if (previewInputUrl) URL.revokeObjectURL(previewInputUrl);
    if (nextFile) {
      setPreviewInputUrl(URL.createObjectURL(nextFile));
    } else {
      setPreviewInputUrl("");
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <PageHeader
        icon={ImageUp}
        title="Thumbnail para YouTube"
        description="Redimensione qualquer imagem para o tamanho ideal de miniatura: 1280x720 (16:9)."
      />

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_200px_160px]">
            <div className="grid gap-2">
              <Label htmlFor="image-input">
                Clique ou arraste sua imagem aqui
              </Label>
              <Input
                id="image-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="h-12 border-dashed"
              />
            </div>

            <div className="grid gap-2">
              <Label>Ajuste</Label>
              <Select value={fitMode} onValueChange={(value) => setFitMode(value as FitMode)}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Preencher (cortar)</SelectItem>
                  <SelectItem value="contain">Ajustar (com bordas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid items-end">
              <Button className="h-12 gap-2" onClick={handleGenerate} disabled={!file || isProcessing}>
                <Upload className="h-4 w-4" />
                {isProcessing ? "Processando..." : "Gerar thumbnail"}
              </Button>
            </div>
          </div>

          {sizeText ? <p className="text-sm text-muted-foreground">{sizeText}</p> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Original</CardTitle>
              </CardHeader>
              <CardContent>
                {previewInputUrl ? (
                  <img src={previewInputUrl} alt="Original" className="w-full max-h-[360px] rounded-md border object-contain" />
                ) : (
                  <div className="grid h-[240px] place-items-center rounded-md border border-dashed text-sm text-muted-foreground">
                    JPG, PNG, WebP
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Thumbnail (1280x720)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {previewOutputUrl ? (
                  <img src={previewOutputUrl} alt="Thumbnail" className="w-full max-h-[360px] rounded-md border object-contain" />
                ) : (
                  <div className="grid aspect-video place-items-center rounded-md border border-dashed text-sm text-muted-foreground">
                    Gere a thumbnail para visualizar
                  </div>
                )}

                <Button asChild disabled={!previewOutputUrl} className="w-full gap-2">
                  <a href={previewOutputUrl || "#"} download="thumbnail-youtube.jpg">
                    <Download className="h-4 w-4" />
                    Baixar thumbnail
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
