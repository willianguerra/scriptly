# Especificação — POC de geração de vídeo no Google Flow

## Objetivo

Validar, no Flow Agent local, o caminho mínimo de um prompt para um único vídeo:

```text
prompt → Google Flow → geração → download → arquivo MP4 local
```

O endpoint temporário é `POST /debug/generate-video`. A implementação não integra
Prisma, Next.js, filas, WebSocket, imagens ou múltiplos browsers.

## Restrição de custo

A POC opera exclusivamente com uma configuração que a interface do Google Flow
identifique como gratuita:

- modo `Vídeo`;
- modelo `Veo 3.1 - Lite [Lower Priority]`;
- duração `4s`;
- quantidade `x1`;
- custo exibido igual a `0 créditos`.

O custo é uma pré-condição de segurança. Se o indicador estiver ausente, ilegível ou
for diferente de zero, o Agent deve encerrar a execução como `REJECTED` antes de clicar
no botão que envia a geração. O Agent não tenta contornar limites, CAPTCHA, autenticação,
2FA, fingerprint ou mecanismos antibot.

## Contrato HTTP

Entrada:

```json
{ "prompt": "PROMPT DE TESTE" }
```

Sucesso:

```json
{
  "status": "completed",
  "file": "C:\\...\\Documents\\Scriptly\\Downloads\\debug\\0001.mp4",
  "duration_seconds": 123.0
}
```

Falha operacional:

```json
{
  "status": "failed",
  "error_code": "AUTH_REQUIRED",
  "error_message": "manual Google Flow authentication is required"
}
```

Entrada inválida usa a validação padrão do FastAPI (`422`). Uma segunda chamada
simultânea falha como `BUSY`; esta fase não cria uma fila.

## Estados

`PREPARING`, `SUBMITTING`, `GENERATING`, `DOWNLOADING`, `COMPLETED`, `FAILED`,
`REJECTED`, `TIMEOUT` e `AUTH_REQUIRED`.

## Fluxo

1. Abrir ou reutilizar o Chromium persistente e a página oficial configurada.
2. Detectar login ausente ou interação humana obrigatória.
3. Abrir um projeto novo e vazio.
4. Selecionar a configuração gratuita definida acima.
5. Ler e validar o custo no DOM; falhar de forma fechada se não for zero.
6. Inserir o prompt e enviar uma única geração.
7. Aguardar mudanças observáveis no DOM, com timeout configurável.
8. Abrir o resultado, capturar o evento de download e salvar no próximo nome numérico
   disponível (`0001.mp4`, `0002.mp4`, ...), sem sobrescrever arquivos.
9. Validar que o resultado não está vazio e possui assinatura MP4 (`ftyp`).

Todos os seletores do Flow ficam centralizados em
`app/automation/flow/selectors.py`. Delays longos não são mecanismo de sincronização.

## Diagnóstico

Em falha, o Agent registra o erro e tenta salvar:

- screenshot PNG;
- JSON com URL atual sem query/fragment, estado e histórico da execução;
- código e mensagem de erro.

Os artefatos ficam em `<data_dir>/logs/errors`. Metadados estruturados e logs não gravam
prompt, cookies, HTML, credenciais ou headers de autenticação. Como a screenshot registra
a interface visível, ela é um artefato local potencialmente sensível.

## Configuração

- `FLOW_AGENT_GENERATION_TIMEOUT_SECONDS` — timeout total da geração;
- `FLOW_AGENT_DOWNLOADS_DIR` — diretório de downloads da POC;
- as configurações existentes controlam URL oficial, profile, dados e navegação.

O diretório padrão de downloads no Windows é
`%USERPROFILE%\\Documents\\Scriptly\\Downloads\\debug`.

## Estratégia de testes

- testes unitários não acessam o Google Flow e não consomem créditos;
- doubles verificam estados, custo zero, rejeição de custo desconhecido/positivo,
  autenticação, timeout, download e diagnóstico;
- testes HTTP verificam sucesso, falha, conflito e entrada inválida;
- um script manual executa dez chamadas sequenciais, nunca em paralelo, e interrompe a
  série no primeiro resultado que não seja `completed`;
- a série manual só deve ser iniciada após confirmar visualmente que o modelo continua
  mostrando `0 créditos`.

## Critérios de conclusão

- endpoint de debug implementado;
- proteção de custo zero coberta por testes;
- uma geração gratuita real pelo endpoint comprovada com MP4 válido;
- procedimento de dez gerações sequenciais preparado, sem executá-lo automaticamente;
- suíte Python e verificações estáticas passam;
- nenhuma alteração em Prisma, Next.js ou comportamento existente do Scriptly.
