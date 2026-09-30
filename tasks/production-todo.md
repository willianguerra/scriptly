# Checklist — Estúdio de produção

- [x] Contratos de cena, busca, timeline e transição com testes.
- [x] Modelos Prisma de projeto e job ligados a usuário.
- [x] Planejador de roteiro e busca Pexels com metadados/ranking.
- [x] APIs escopadas por usuário para projeto, cena, candidatos e jobs.
- [x] Página `/estudio` recuperável com storyboard e controles de edição.
- [x] Adaptador TTS explícito e configuração VoiceStudio opcional.
- [x] Worker de renderização segura e fila recuperável.
- [x] Catálogo configurável e seed de demonstração rotulado.
- [x] README e `.env.example` atualizados.
- [x] Testes automatizados, lint, build e verificação da tela autenticada.

## Ambiente necessário para rodar a integração

- Configure `DATABASE_URL` e `AUTH_SESSION_SECRET`, depois execute `npm run db:push`.
- Configure `PEXELS_API_KEY` para pesquisa e exportação com clipes reais.
- Configure `VOICESTUDIO_BASE_URL`, `VOICESTUDIO_API_KEY` e `VOICESTUDIO_MODEL` para síntese local/remota via VoiceStudio.
- Execute `npm run worker:production` em processo separado e mantenha web e worker no mesmo `MEDIA_STORAGE_DIR`.
- A verificação visual alcançou a barreira de login; sem banco e sessão local configurados não foi possível entrar em `/estudio` ou executar um render integrado.
