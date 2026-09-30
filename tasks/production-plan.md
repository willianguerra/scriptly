# Plano de implementação — Estúdio de produção Scriptly

## Objetivo
Adicionar ao Scriptly existente um fluxo recuperável e autenticado de roteiro, plano de cenas, busca licenciada, escolha/recorte de clipes, narração e exportação via worker FFmpeg.

## Decisões de arquitetura
- Novo `ProductionProject` pertence diretamente a `User`; `ProductionJob` guarda filas/retries/status e também valida `userId`.
- Cartões e candidatos são JSON validados com Zod, evitando tabelas prematuras e mantendo metadados de licença/atribuição.
- Pexels é o primeiro provedor; requer `PEXELS_API_KEY`, segue API oficial e apresenta atribuição/link. Nenhuma busca/extração indiscriminada do YouTube.
- A API web apenas enfileira. Um worker Node separado busca jobs e usa spawn com argumentos, diretório controlado e FFmpeg/ffprobe empacotados.
- Narração usa o provider Darkvi existente. VoiceStudio via OpenAI-compatible é opt-in, URL interna configurada no servidor, com indisponibilidade explícita; sem chamada a localhost arbitrário do usuário.
- Roteiro pronto é dividido deterministicamente em cenas, e provider LLM existente pode estruturar um briefing. Busca visual não afirma espécie/ação exata sem confiança alta.

## Fases
1. Contratos Zod, ranking e estados; testes unitários antes da lógica.
2. Persistência Prisma e APIs autenticadas para projetos/cenas/candidatos/jobs com checagem de posse.
3. Provedor Pexels e planejamento do roteiro, preservando fonte, licença, crédito e motivo/confiança.
4. Estúdio responsivo integrado à navegação: configuração, storyboard, busca, escolha e recorte, voz, timeline/estados e exportação.
5. Worker render com fila recuperável, limites e verificação ffprobe; documentação de mídia, TTS e catálogo tipado/seeds.
6. Verificação solicitada: `npm test`, `npm run lint`, `npm run build`, corrigindo regressões introduzidas.

## Aceite
- Usuário pode criar/reabrir projeto, gerar cartões, pesquisar candidatos, selecionar e recortar; a licença/atribuição são visíveis.
- APIs recusam acesso cruzado por usuário e persistem estado/erros/retries.
- Jobs longos são executados fora das requisições HTTP; exportação só é marcada concluída após validação de streams.
- Integrações ausentes exibem configuração necessária; nenhuma narração ou exportação simulada como real.
