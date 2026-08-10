# Scriptly Flow Agent

Serviço Python local que mantém um Chromium persistente e oferece uma prova de conceito
para gerar um único vídeo no Google Flow e baixá-lo como MP4. A autenticação continua
manual. Esta fase não possui Prisma, fila, WebSocket, imagens nem integração com a
interface Next.js.

## Requisitos e instalação

- Python 3.12 ou superior;
- Chromium instalado pelo Playwright;
- uma sessão Google Flow autenticada manualmente no profile persistente.

Na raiz do repositório:

```bash
cd flow-agent
python -m venv .venv
pip install -e .
playwright install chromium
uvicorn app.main:app --host 127.0.0.1 --port 8765
```

No Windows PowerShell, ative o ambiente com:

```powershell
.venv\Scripts\Activate.ps1
```

Também é possível iniciar com `python -m app.main`. O Agent aceita somente endereços de
loopback e usa `127.0.0.1:8765` por padrão; `0.0.0.0` é rejeitado.

## Profile e login manual

O Browser Manager usa `launch_persistent_context`. Cookies e armazenamento permanecem no
profile do Chromium; o Agent não exporta cookies nem recebe usuário, senha, 2FA ou
CAPTCHA. No Windows, o profile padrão fica em:

```text
%LOCALAPPDATA%\ScriptlyFlowAgent\profiles\video
```

Não abra duas instâncias do Agent com o mesmo profile. Se a sessão expirar ou o Flow
pedir interação humana, a geração termina como `AUTH_REQUIRED` para o usuário resolver
manualmente na janela visível.

## Proteção de custo zero

A POC seleciona somente:

- `Vídeo`;
- `Veo 3.1 - Lite [Lower Priority]`;
- `4s`;
- `16:9`;
- `x1`.

Antes de enviar o prompt, o Agent lê o custo exibido pelo Flow. Somente o valor exato
`0 créditos` permite o clique. Valor positivo, ausente ou ilegível retorna
`NON_ZERO_OR_UNKNOWN_COST` sem iniciar a geração. Como a interface externa pode mudar,
confirme visualmente o custo antes de qualquer validação manual.

## Endpoints

- `GET /health` — saúde e versão do Agent;
- `GET /status` — estado do Agent, browser e Flow;
- `POST /browser/open` — abre/reutiliza o Chromium persistente;
- `POST /browser/close` — fecha contexto e Playwright;
- `GET /browser/status` — estado e profile;
- `POST /flow/open` — abre a URL oficial configurada;
- `POST /debug/generate-video` — executa uma geração de vídeo por vez.

Exemplo de geração:

```powershell
$body = @{ prompt = "Ocean waves at sunrise" } | ConvertTo-Json
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8765/debug/generate-video `
  -ContentType application/json `
  -Body $body
```

Sucesso:

```json
{
  "status": "completed",
  "file": "C:\\Users\\...\\Documents\\Scriptly\\Downloads\\debug\\0001.mp4",
  "duration_seconds": 123.0
}
```

Falhas operacionais retornam HTTP 200 com `status: "failed"`, `error_code` e
`error_message`. Entrada inválida retorna `422`. Uma chamada concorrente retorna `BUSY`;
não existe fila nesta fase.

## Arquivos e diagnósticos

Downloads usam nomes previsíveis e nunca sobrescrevem um arquivo existente:

```text
%USERPROFILE%\Documents\Scriptly\Downloads\debug\0001.mp4
```

Em falhas, screenshots e metadados sanitizados ficam em:

```text
%LOCALAPPDATA%\ScriptlyFlowAgent\logs\errors
```

O JSON de diagnóstico e os logs contêm estado, histórico, erro e URL sem query/fragment;
eles não armazenam prompt, cookies, HTML ou credenciais. A screenshot é local e pode
registrar o conteúdo visível na página, por isso deve ser tratada como dado sensível.

## Configuração

Copie `.env.example` para `.env` ou defina variáveis `FLOW_AGENT_*` no ambiente.

| Variável | Padrão | Finalidade |
| --- | --- | --- |
| `FLOW_AGENT_HOST` | `127.0.0.1` | Endereço de loopback |
| `FLOW_AGENT_PORT` | `8765` | Porta local |
| `FLOW_AGENT_CORS_ORIGINS` | origins locais na porta 3000 | CORS explícito |
| `FLOW_AGENT_LOG_LEVEL` | `INFO` | Nível de log |
| `FLOW_AGENT_DATA_DIR` | diretório local do sistema | Profile e logs |
| `FLOW_AGENT_BROWSER_PROFILE` | `video` | Nome do profile |
| `FLOW_AGENT_BROWSER_HEADLESS` | `false` | Janela visível para interação manual |
| `FLOW_AGENT_FLOW_URL` | URL HTTPS oficial | Endereço do Flow |
| `FLOW_AGENT_NAVIGATION_TIMEOUT_MS` | `60000` | Timeout de navegação/UI |
| `FLOW_AGENT_GENERATION_TIMEOUT_SECONDS` | `900` | Timeout da geração gratuita |
| `FLOW_AGENT_DOWNLOADS_DIR` | Documents/Scriptly/Downloads/debug | Saída de MP4 |

## Testes sem consumo de créditos

```bash
pip install -e ".[test]"
pytest
```

Os testes usam doubles e não acessam o Google Flow. Para preparar a aceitação pedida de
dez gerações reais, primeiro confirme visualmente `0 créditos` e execute, de forma
deliberada:

```powershell
python scripts/validate_debug_generations.py --confirm-zero-credits
```

O script faz chamadas estritamente sequenciais, valida arquivos distintos e interrompe
no primeiro erro. Ele não é executado pela suíte automática.
