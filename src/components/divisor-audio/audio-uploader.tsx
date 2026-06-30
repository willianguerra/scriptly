"use client";

import * as React from "react";
import { Mic, Square, UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AUDIO_ACCEPT_ATTR } from "@/lib/audioUtils";

type AudioUploaderProps = {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
};

/** Área de upload com drag and drop e gravação pelo microfone. */
export function AudioUploader({ onFileSelected, disabled }: AudioUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const [isRecording, setIsRecording] = React.useState(false);
  const [recordError, setRecordError] = React.useState<string | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];
    if (file) onFileSelected(file);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFiles(event.dataTransfer.files);
  }

  async function startRecording() {
    setRecordError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordError("Seu navegador não suporta gravação pelo microfone.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const extension = type.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `gravacao-${Date.now()}.${extension}`, { type });
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        if (file.size > 0) onFileSelected(file);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setRecordError(
        "Não foi possível acessar o microfone. Verifique as permissões do navegador."
      );
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  React.useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !disabled) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-primary/60 hover:bg-accent/40",
          isDragging ? "border-primary bg-accent/50" : "border-border"
        )}
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-6 w-6" />
        </span>
        <p className="text-sm font-medium">
          Arraste um arquivo de áudio ou clique para selecionar
        </p>
        <p className="text-xs text-muted-foreground">
          Formatos suportados: MP3, WAV, M4A e OGG (máx. 100 MB)
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={AUDIO_ACCEPT_ATTR}
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            handleFiles(event.target.files);
            // permite re-selecionar o mesmo arquivo
            event.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isRecording ? (
          <Button
            type="button"
            variant="destructive"
            onClick={stopRecording}
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Parar gravação
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={startRecording}
            disabled={disabled}
            className="gap-2"
          >
            <Mic className="h-4 w-4" />
            Gravar pelo microfone
          </Button>
        )}
        {isRecording && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
            Gravando...
          </span>
        )}
      </div>

      {recordError && (
        <p className="text-sm text-destructive" role="alert">
          {recordError}
        </p>
      )}
    </div>
  );
}

export default AudioUploader;
