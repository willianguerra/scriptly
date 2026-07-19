import { GEMINI_MODELO_PADRAO } from "../roteiro/gemini.ts";
import { OPENAI_MODELO_PADRAO } from "../roteiro/openai.ts";
import type { ProviderRoteiro } from "../roteiro/types.ts";
import { DOTTI_AGENT_SYSTEM } from "./agent.ts";
import {
  montarContextoDoProjeto,
  montarInstrucaoDaEtapa,
  type EtapaChatPrompts,
  type MensagemChatPrompts,
} from "./flow.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_PARTES = 8;

type EntradaRespostaAgente = {
  provider: ProviderRoteiro;
  etapa: EtapaChatPrompts;
  roteiro: string;
  sincronizacao: string;
  mensagens: MensagemChatPrompts[];
  mensagemUsuario?: string;
  chave: string | null;
  modelo?: string;
};

type ResultadoRespostaAgente = {
  texto: string;
  provider: ProviderRoteiro;
  modelo: string;
};

type OpenAIMessage = { role: "system" | "user" | "assistant"; content: string };
type GeminiContent = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

function sistemaComContexto(entrada: EntradaRespostaAgente): string {
  return `${DOTTI_AGENT_SYSTEM}\n\n${montarContextoDoProjeto(entrada)}`;
}

function historicoValido(mensagens: MensagemChatPrompts[]) {
  return mensagens
    .filter(
      (mensagem) =>
        (mensagem.role === "user" || mensagem.role === "assistant") &&
        mensagem.content.trim()
    )
    .map((mensagem) => ({ role: mensagem.role, content: mensagem.content.trim() }));
}

function respostaFake(entrada: EntradaRespostaAgente): string {
  switch (entrada.etapa) {
    case "analise":
      return `ROTEIRO RECEBIDO E ANALISADO

HISTÓRIA: Projeto de teste — ${entrada.roteiro.trim().slice(0, 80)}
GÊNERO: drama cinematográfico
CENÁRIO: ambiente definido pelo roteiro

PALETA VISUAL:
- Cores dominantes: tons frios com pontos de luz dourada
- Estilo de iluminação: low-key cinematográfica
- Atmosfera: contemplativa e crescente

PERSONAGENS PRINCIPAIS (por ordem de importância):
[1] PROTAGONISTA — 30 years old woman, olive-skinned, athletic build, long wavy black hair
    Roupa padrão: wearing dark travel coat, neutral linen shirt, fitted trousers, worn leather boots
    Papel: conduz a narrativa.
[2] ALIADO — 35 years old man, tan-skinned, tall lean build, short curly brown hair
    Roupa padrão: wearing charcoal jacket, beige shirt, dark trousers, leather boots
    Papel: apoia a protagonista.
[3] OBSERVADORA — 45 years old woman, dark-skinned, average build, shoulder-length braided black hair
    Roupa padrão: wearing long navy coat, gray blouse, black trousers, flat boots
    Papel: revela contexto.

PERSONAGENS SECUNDÁRIOS/FIGURANTES:
- Figurantes locais: 25 years old adults, varied skin tones, average builds, varied natural hair, wearing practical neutral clothing.

Confirme se os personagens e a paleta visual estão corretos antes de prosseguir.`;
    case "referencias":
      return `===============================================================================
PROMPTS DE REFERÊNCIA — IMAGENS DOS PERSONAGENS
===============================================================================

CHARACTER 1 — PROTAGONISTA:
Full body portrait, standing neutral pose, arms relaxed at sides, facing camera. 30 years old woman, olive-skinned, athletic build, long wavy black hair. Wearing dark travel coat, neutral linen shirt, fitted trousers, worn leather boots. Expression: neutral, looking at camera. Clean white background, studio lighting, full body visible head to feet. 8K, photorealistic, fashion photography lighting.

CHARACTER 2 — ALIADO:
Full body portrait, standing neutral pose, arms relaxed at sides, facing camera. 35 years old man, tan-skinned, tall lean build, short curly brown hair. Wearing charcoal jacket, beige shirt, dark trousers, leather boots. Expression: neutral, looking at camera. Clean white background, studio lighting, full body visible head to feet. 8K, photorealistic, fashion photography lighting.

CHARACTER 3 — OBSERVADORA:
Full body portrait, standing neutral pose, arms relaxed at sides, facing camera. 45 years old woman, dark-skinned, average build, shoulder-length braided black hair. Wearing long navy coat, gray blouse, black trousers, flat boots. Expression: neutral, looking at camera. Clean white background, studio lighting, full body visible head to feet. 8K, photorealistic, fashion photography lighting.`;
    case "cenas": {
      const blocos = Array.from(
        entrada.sincronizacao.matchAll(
          /PROMPT\s+(\d+)\s*\|\s*([^\n\r]+)[\r\n]+([^\r\n]*)/gi
        )
      );
      const prompts = blocos.map((bloco, index) => {
        const numero = bloco[1].padStart(3, "0");
        const timestamp = bloco[2].trim();
        const continuidade = index > 0 ? " Continuing from previous position." : "";
        return `PROMPT ${numero} [1] | ${timestamp}:
Live-action cinematic film, photorealistic, real human actors, drama movie. Visual-only scene. Slow tracking camera, eye-level medium-wide composition.${continuidade} Character 1 moving through the location with a deliberate measured pace (level 4), focused eyes and restrained determination, studying the surrounding details before reacting to a newly discovered visual clue with a subtle change in posture. Environment: detailed cinematic setting shaped by the story, cool directional light with warm highlights, layered depth and atmospheric particles, consistent objects and lighting direction across the sequence. Clean frame. 8K, photorealistic, dramatic low-key lighting.`;
      });
      return `===============================================================================
PROMPTS DE CENA V2.0 — SINCRONIZADOS
===============================================================================

${prompts.join("\n\n")}

===============================================================================
TOTAL: ${prompts.length} prompts gerados
VERSÃO: DOTTI AGENT 2.0
===============================================================================`;
    }
    case "gestao":
      return `DIAGNÓSTICO DE FALHAS:

Pedido analisado: ${entrada.mensagemUsuario?.trim()}
Padrão identificado: modo de teste ativo. Selecione Gemini ou OpenAI para reescrever os prompts com diagnóstico completo, preservando numeração, timestamps e colchetes.`;
  }
}

async function gerarComOpenAI(
  entrada: EntradaRespostaAgente,
  modelo: string
): Promise<string> {
  const mensagens: OpenAIMessage[] = [
    { role: "system", content: sistemaComContexto(entrada) },
    ...historicoValido(entrada.mensagens),
    {
      role: "user",
      content: montarInstrucaoDaEtapa(entrada.etapa, entrada.mensagemUsuario),
    },
  ];
  let respostaCompleta = "";

  for (let parte = 0; parte < MAX_PARTES; parte += 1) {
    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${entrada.chave}`,
        },
        body: JSON.stringify({ model: modelo, messages: mensagens, max_tokens: 16000 }),
        cache: "no-store",
      });
    } catch {
      throw new Error("Falha ao contatar a API da OpenAI.");
    }

    const data = (await res.json().catch(() => null)) as {
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
      error?: { message?: string };
    } | null;
    if (!res.ok) {
      throw new Error(data?.error?.message || `Erro ${res.status} da API da OpenAI.`);
    }

    const texto = data?.choices?.[0]?.message?.content?.trimEnd() ?? "";
    if (!texto) throw new Error("A OpenAI não retornou texto para os prompts.");
    respostaCompleta += texto;

    if (data?.choices?.[0]?.finish_reason !== "length") return respostaCompleta.trim();

    mensagens.push({ role: "assistant", content: texto });
    mensagens.push({
      role: "user",
      content:
        "Continue exatamente do ponto interrompido, sem repetir texto, numeração ou cabeçalhos. Termine todos os blocos restantes e o rodapé obrigatório.",
    });
  }

  throw new Error("A resposta excedeu o limite mesmo após continuações automáticas.");
}

async function gerarComGemini(
  entrada: EntradaRespostaAgente,
  modelo: string
): Promise<string> {
  const contents: GeminiContent[] = [
    ...historicoValido(entrada.mensagens).map((mensagem) => ({
      role: mensagem.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: mensagem.content }],
    })),
    {
      role: "user",
      parts: [{ text: montarInstrucaoDaEtapa(entrada.etapa, entrada.mensagemUsuario) }],
    },
  ];
  const url = `${GEMINI_BASE_URL}/${encodeURIComponent(modelo)}:generateContent`;
  let respostaCompleta = "";

  for (let parte = 0; parte < MAX_PARTES; parte += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": entrada.chave ?? "",
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sistemaComContexto(entrada) }] },
          contents,
          generationConfig: { maxOutputTokens: 16384 },
        }),
        cache: "no-store",
      });
    } catch {
      throw new Error("Falha ao contatar a API do Gemini.");
    }

    const data = (await res.json().catch(() => null)) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
      promptFeedback?: { blockReason?: string };
      error?: { message?: string };
    } | null;
    if (!res.ok) {
      throw new Error(data?.error?.message || `Erro ${res.status} da API do Gemini.`);
    }
    if (data?.promptFeedback?.blockReason) {
      throw new Error(`O Gemini bloqueou a resposta (${data.promptFeedback.blockReason}).`);
    }

    const texto = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((item) => item.text ?? "")
      .join("")
      .trimEnd();
    if (!texto) throw new Error("O Gemini não retornou texto para os prompts.");
    respostaCompleta += texto;

    if (data?.candidates?.[0]?.finishReason !== "MAX_TOKENS") {
      return respostaCompleta.trim();
    }

    contents.push({ role: "model", parts: [{ text: texto }] });
    contents.push({
      role: "user",
      parts: [
        {
          text: "Continue exatamente do ponto interrompido, sem repetir texto, numeração ou cabeçalhos. Termine todos os blocos restantes e o rodapé obrigatório.",
        },
      ],
    });
  }

  throw new Error("A resposta excedeu o limite mesmo após continuações automáticas.");
}

export async function gerarRespostaDoAgente(
  entrada: EntradaRespostaAgente
): Promise<ResultadoRespostaAgente> {
  montarContextoDoProjeto(entrada);

  if (entrada.provider === "fake") {
    return { texto: respostaFake(entrada), provider: "fake", modelo: "fake-dotti-2" };
  }
  if (!entrada.chave) {
    throw new Error(
      entrada.provider === "openai"
        ? "Chave da API da OpenAI não informada."
        : "Chave da API do Gemini não informada."
    );
  }

  const modelo =
    entrada.modelo?.trim() ||
    (entrada.provider === "openai" ? OPENAI_MODELO_PADRAO : GEMINI_MODELO_PADRAO);
  const texto =
    entrada.provider === "openai"
      ? await gerarComOpenAI(entrada, modelo)
      : await gerarComGemini(entrada, modelo);
  return { texto, provider: entrada.provider, modelo };
}
