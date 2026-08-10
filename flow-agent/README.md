# Scriptly Flow Agent

Serviço Python local que mantém um Chromium persistente para o usuário abrir o
Google Flow e fazer login manualmente. Esta fase controla somente o ciclo de vida
do navegador e a abertura da página. Não há automação de login, geração, download,
fila, WebSocket ou integração com Prisma.

## Requisitos

- Python 3.12 ou superior;
- acesso local à porta configurada;
- Chromium instalado pelo Playwright.

## Instalação e execução

Execute a partir da raiz do repositório:

```bash
cd flow-agent
python -m venv .venv
pip install -e .
playwright install chromium
uvicorn app.main:app --host 127.0.0.1 --port 8765
```

Ative o ambiente virtual antes de `pip`, `playwright` e `uvicorn`. No Windows
PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Também é possível iniciar usando todas as configurações do ambiente:

```bash
python -m app.main
```

Por segurança, o Agent aceita apenas endereços de loopback e usa
`127.0.0.1:8765` como padrão. `0.0.0.0` é rejeitado. Requisições mutáveis que
informem um `Origin` não configurado também são rejeitadas.

## Profile persistente e login manual

O Browser Manager usa `launch_persistent_context` do Playwright. O Chromium
mantém cookies e armazenamento do site diretamente no próprio profile; o Agent
não exporta cookies para JSON e não recebe usuário, senha, 2FA ou CAPTCHA.

No Windows, o profile padrão fica em:

```text
%LOCALAPPDATA%\ScriptlyFlowAgent\profiles\video
```

O diretório também pode ser definido por `FLOW_AGENT_DATA_DIR`, mas deve ficar
fora do código-fonte. Um mesmo profile não deve ser aberto simultaneamente por
mais de uma instância do Agent.

## Endpoints

### `GET /health`

```json
{
  "status": "ok",
  "service": "scriptly-flow-agent",
  "version": "0.2.0"
}
```

### `GET /status`

Antes da abertura do navegador:

```json
{
  "agent": "ready",
  "browser": "stopped",
  "flow": "unknown"
}
```

Depois de abrir o navegador e o Flow:

```json
{
  "agent": "ready",
  "browser": "running",
  "flow": "opened"
}
```

### `POST /browser/open`

Abre ou reutiliza o Chromium associado ao profile configurado.

```json
{ "status": "opened" }
```

### `POST /browser/close`

Fecha corretamente o contexto persistente e o Playwright. A operação é
idempotente.

```json
{ "status": "closed" }
```

### `GET /browser/status`

```json
{
  "running": true,
  "profile": "video"
}
```

### `POST /flow/open`

Com o navegador aberto, navega uma aba para a URL configurada do Google Flow.
Se o browser estiver parado, retorna `409 BROWSER_NOT_RUNNING`. A autenticação na
página é sempre manual.

```json
{ "status": "opened" }
```

## Configuração

Copie `.env.example` para `.env` ou defina as variáveis no ambiente. O arquivo
`.env` não deve ser versionado.

| Variável | Padrão | Finalidade |
| --- | --- | --- |
| `FLOW_AGENT_HOST` | `127.0.0.1` | Endereço de loopback do serviço |
| `FLOW_AGENT_PORT` | `8765` | Porta TCP local |
| `FLOW_AGENT_CORS_ORIGINS` | `http://127.0.0.1:3000,http://localhost:3000` | Origens Scriptly permitidas |
| `FLOW_AGENT_LOG_LEVEL` | `INFO` | Nível de logging |
| `FLOW_AGENT_DATA_DIR` | diretório local do sistema | Raiz dos dados persistentes, fora do código |
| `FLOW_AGENT_BROWSER_PROFILE` | `video` | Nome seguro do profile Chromium |
| `FLOW_AGENT_BROWSER_HEADLESS` | `false` | Mantém a janela visível para login manual |
| `FLOW_AGENT_FLOW_URL` | `https://labs.google/fx/tools/flow` | URL HTTPS oficial do Flow |
| `FLOW_AGENT_NAVIGATION_TIMEOUT_MS` | `60000` | Timeout de navegação, entre 1 e 300 segundos |

O CORS não aceita wildcard, não permite credenciais cross-origin e libera apenas
`GET` e `POST` para as origens configuradas.

## Validação manual da sessão

Com o Agent em execução, use outro terminal PowerShell:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8765/browser/open
Invoke-RestMethod -Method Post http://127.0.0.1:8765/flow/open
Invoke-RestMethod http://127.0.0.1:8765/status
```

Na janela aberta, faça login manualmente no Google. Depois:

1. feche o Agent com `Ctrl+C`, permitindo que o lifecycle encerre o contexto;
2. inicie novamente o mesmo comando `uvicorn`;
3. execute `POST /browser/open` e `POST /flow/open` novamente;
4. confirme visualmente que a sessão continua autenticada;
5. finalize com `POST /browser/close`.

Não execute duas instâncias usando o profile `video` ao mesmo tempo.

## Testes

Instale o extra de desenvolvimento e execute:

```bash
pip install -e ".[test]"
pytest
```

Os testes unitários usam doubles do Playwright e não acessam o Google Flow. O
smoke test manual descrito acima é responsável por verificar a janela real e a
persistência da sessão.
