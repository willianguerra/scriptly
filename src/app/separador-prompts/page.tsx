import { PromptSplitter } from "@/components/separador-prompts/prompt-splitter";

export default function SeparadorPromptsPage() {
  return (
    <div className="mx-auto h-[calc(100dvh-2rem)] min-h-0 max-w-7xl p-4 md:p-6">
      <PromptSplitter />
    </div>
  );
}
