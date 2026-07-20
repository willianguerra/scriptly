export type EtapaChatPrompts = "analise" | "referencias" | "cenas" | "gestao";

export type MensagemChatPrompts = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function avancarEtapaChat(etapa: EtapaChatPrompts): EtapaChatPrompts {
  switch (etapa) {
    case "analise":
      return "referencias";
    case "referencias":
      return "cenas";
    case "cenas":
    case "gestao":
      return "gestao";
  }
}

export function montarContextoDoProjeto({
  roteiro,
  sincronizacao,
}: {
  roteiro: string;
  sincronizacao: string;
}): string {
  const roteiroLimpo = roteiro.trim();
  const sincronizacaoLimpa = sincronizacao.trim();

  if (!roteiroLimpo) throw new Error("O roteiro do projeto está vazio.");
  if (!sincronizacaoLimpa) throw new Error("A sincronização do projeto está vazia.");

  return [
    "CONTEXTO FIXO — não peça estes materiais novamente e nunca os substitua pelo histórico do chat.",
    "",
    "=== ROTEIRO FIXO DO PROJETO ===",
    roteiroLimpo,
    "",
    "=== SINCRONIZAÇÃO FIXA DO PROJETO ===",
    sincronizacaoLimpa,
    "=== FIM DO CONTEXTO FIXO ===",
  ].join("\n");
}

export function montarInstrucaoDaEtapa(
  etapa: EtapaChatPrompts,
  mensagemUsuario?: string
): string {
  const ajuste = mensagemUsuario?.trim();

  switch (etapa) {
    case "analise":
      return [
        ajuste
          ? "Revise somente a ETAPA 1 do Scriptly Agent 2.0 conforme o pedido do usuário."
          : "Execute somente a ETAPA 1 do Scriptly Agent 2.0.",
        "Analise o roteiro fixo e responda no formato 'ROTEIRO RECEBIDO E ANALISADO'.",
        "Defina gênero, cenário, paleta, os 3 personagens principais em ordem de importância e todos os secundários.",
        "Não gere ainda prompts de referência nem prompts de cena.",
        ajuste ? `PEDIDO DE AJUSTE: ${ajuste}` : "",
      ].join(" ");
    case "referencias":
      return [
        ajuste
          ? "Revise somente a ETAPA 2 conforme o pedido do usuário."
          : "A análise foi confirmada. Execute somente a ETAPA 2.",
        "Gere 'PROMPTS DE REFERÊNCIA — IMAGENS DOS PERSONAGENS' para Character 1, 2 e 3 usando exatamente as decisões confirmadas no histórico.",
        "Não gere ainda os prompts sincronizados de cena.",
        ajuste ? `PEDIDO DE AJUSTE: ${ajuste}` : "",
      ].join(" ");
    case "cenas":
      return [
        "As referências foram confirmadas. Execute somente a ETAPA 3.",
        "Gere todos os prompts de cena V2.0, exatamente um prompt para cada bloco da sincronização fixa, sem parar no meio.",
        "Preserve timestamps e numeração, aplique continuidade entre blocos e termine com o total conferido.",
      ].join(" ");
    case "gestao": {
      const pedido = ajuste;
      if (!pedido) throw new Error("Escreva o que precisa revisar nos prompts.");
      return [
        "A FASE 2 está ativa. Trate o pedido abaixo seguindo as ETAPAS 4 e 5 do Scriptly Agent 2.0.",
        "Use os prompts já gerados no histórico; não peça que sejam enviados novamente, preserve numeração, timestamps e todo conteúdo entre colchetes.",
        "PEDIDO DO USUÁRIO:",
        pedido,
      ].join("\n");
    }
  }
}
