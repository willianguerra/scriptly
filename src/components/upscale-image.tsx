"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, ImageUp } from "lucide-react";

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

export default function UpscaleImage() {
  const [file, setFile] = React.useState<File | null>(null);
  const [factor, setFactor] = React.useState("2");
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

  async function handleUpscale() {
    if (!file) return;
    setIsProcessing(true);

    try {
      const image = await loadImageFromFile(file);
      const scale = Number(factor);
      const width = image.width * scale;
      const height = image.height * scale;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas nao suportado");

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((createdBlob) => resolve(createdBlob), "image/png");
      });

      if (!blob) throw new Error("Falha ao gerar imagem final");

      if (previewOutputUrl) URL.revokeObjectURL(previewOutputUrl);
      const outputUrl = URL.createObjectURL(blob);
      setPreviewOutputUrl(outputUrl);
      setSizeText(`${image.width}x${image.height} -> ${width}x${height}`);
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
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="flex items-center gap-3 text-3xl font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-lg border bg-muted text-muted-foreground">
            <ImageUp className="h-5 w-5" />
          </span>
          Upscaler de Imagem com IA
        </h1>
        <p className="text-muted-foreground">Aumente a resolucao de suas imagens em ate 4x.</p>
      </div>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_170px_160px]">
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
              <Label>Escala</Label>
              <Select value={factor} onValueChange={setFactor}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2x</SelectItem>
                  <SelectItem value="3">3x</SelectItem>
                  <SelectItem value="4">4x</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid items-end">
              <Button className="h-12 gap-2" onClick={handleUpscale} disabled={!file || isProcessing}>
                <Upload className="h-4 w-4" />
                {isProcessing ? "Processando..." : "Upscale"}
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
                <CardTitle className="text-base">Resultado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {previewOutputUrl ? (
                  <img src={previewOutputUrl} alt="Resultado" className="w-full max-h-[360px] rounded-md border object-contain" />
                ) : (
                  <div className="grid h-[240px] place-items-center rounded-md border border-dashed text-sm text-muted-foreground">
                    Gere o upscale para visualizar
                  </div>
                )}

                <Button asChild disabled={!previewOutputUrl} className="w-full gap-2">
                  <a href={previewOutputUrl || "#"} download="imagem-upscale.png">
                    <Download className="h-4 w-4" />
                    Baixar imagem
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
