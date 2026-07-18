// Provider de roteiro "fake": não chama nenhuma IA, apenas devolve um texto
// determinístico. Serve para testar toda a plumbing (rota -> pipeline -> UI)
// sem chave de API, exatamente como o PLAN.md sugere na Fase 1.1.

import type {
  EntradaRoteiro,
  ResultadoRoteiro,
  ScriptProvider,
} from "./types.ts";

export class FakeScriptProvider implements ScriptProvider {
  readonly provider = "fake" as const;

  async gerar(entrada: EntradaRoteiro): Promise<ResultadoRoteiro> {
    const tema = entrada.tema.trim() || "um tema qualquer";
    const texto = [
      `Você já parou para pensar em ${tema}? Fica comigo até o final, porque o que vem agora muda tudo.`,
      `Neste vídeo eu vou te mostrar, de um jeito simples e direto, tudo o que importa sobre ${tema}.`,
      `Se isso te ajudou, deixa o like e se inscreve no canal. Até o próximo vídeo!`,
    ].join("\n\n");

    return { texto, provider: this.provider, modelo: "fake-1" };
  }
}
