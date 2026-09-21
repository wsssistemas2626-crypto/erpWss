# setup.ps1 — prepara o projeto erpWss e abre no container do VS Code
#
# Como usar (no PowerShell, dentro da pasta do projeto, onde estão CLAUDE.md e PROGRESS.md):
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1
#
# O que ele faz:
#   1. Verifica Git, Docker (rodando) e VS Code; instala a extensão Dev Containers se faltar
#   2. Grava as versões corretas de .gitattributes, .devcontainer/devcontainer.json e scripts/iniciar.sh
#   3. Normaliza fins de linha, faz commit e envia ao GitHub
#   4. Abre o VS Code clonando o repositório num volume do container

param(
  [string]$RepoUrl = "https://github.com/wsssistemas2626-crypto/erpWss.git"
)

$ErrorActionPreference = "Stop"

function Passo($t)  { Write-Host ""; Write-Host "== $t ==" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "  [ok] $t" -ForegroundColor Green }
function Falha($t)  { Write-Host "  [ERRO] $t" -ForegroundColor Red; exit 1 }
function Existe($c) { return [bool](Get-Command $c -ErrorAction SilentlyContinue) }

# Executa um comando nativo e falha se o código de saída não for zero
function Rodar([string]$descricao, [scriptblock]$bloco) {
  $ErrorActionPreference = "Continue"
  & $bloco
  if ($LASTEXITCODE -ne 0) { Falha "$descricao (código $LASTEXITCODE)" }
}

# Grava arquivo em UTF-8 sem BOM e com fim de linha LF
function Gravar([string]$caminho, [string]$conteudo) {
  $dir = Split-Path -Parent $caminho
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $lf = ($conteudo -replace "`r`n", "`n") + "`n"
  [System.IO.File]::WriteAllText((Join-Path (Get-Location) $caminho), $lf, (New-Object System.Text.UTF8Encoding $false))
  Ok "gravado $caminho"
}

# ---------------------------------------------------------------------------
Passo "1/4 Verificando pré-requisitos"

if (-not (Test-Path "CLAUDE.md") -or -not (Test-Path "PROGRESS.md")) {
  Falha "rode este script na pasta do projeto (onde estão CLAUDE.md e PROGRESS.md)."
}
if (-not (Existe "git")) { Falha "Git não encontrado. Instale em https://git-scm.com e abra um novo PowerShell." }
Ok "git encontrado"

if (-not (Existe "docker")) { Falha "Docker não encontrado. Instale o Docker Desktop (com WSL2) e abra um novo PowerShell." }
$ErrorActionPreference = "Continue"
docker info *> $null
$dockerOk = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = "Stop"
if (-not $dockerOk) { Falha "o Docker Desktop não está rodando. Abra-o, espere ficar 'running' e rode este script de novo." }
Ok "docker rodando"

$temCode = Existe "code"
if ($temCode) {
  $ErrorActionPreference = "Continue"
  $exts = & code --list-extensions 2>$null
  $ErrorActionPreference = "Stop"
  if ($exts -notcontains "ms-vscode-remote.remote-containers") {
    Rodar "instalar a extensão Dev Containers" { code --install-extension ms-vscode-remote.remote-containers }
  }
  Ok "extensão Dev Containers instalada"
} else {
  Write-Host "  [aviso] comando 'code' não está no PATH. Confira manualmente se a extensão Dev Containers está instalada." -ForegroundColor Yellow
}

$nome = (git config user.name)
$email = (git config user.email)
if (-not $nome)  { $nome  = Read-Host "  Seu nome para os commits do Git";  Rodar "configurar nome"  { git config --global user.name  "$nome" } }
if (-not $email) { $email = Read-Host "  Seu e-mail para os commits do Git"; Rodar "configurar e-mail" { git config --global user.email "$email" } }
Ok "identidade do git: $nome <$email>"

# ---------------------------------------------------------------------------
Passo "2/4 Gravando arquivos de configuração"

Gravar ".gitattributes" @'
# Força fim de linha LF (evita quebra de scripts no container quando o repositório é usado no Windows)
* text=auto eol=lf
*.sh text eol=lf
'@

Gravar ".devcontainer/devcontainer.json" @'
{
  "name": "erp-autoloop",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu-24.04",
  "features": {
    "ghcr.io/devcontainers/features/node:1": { "version": "lts" },
    "ghcr.io/devcontainers/features/docker-in-docker:2": { "moby": false },
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },
  "postCreateCommand": "corepack enable && curl -fsSL https://claude.ai/install.sh | bash",
  "customizations": {
    "vscode": {
      "extensions": ["anthropic.claude-code", "dbaeumer.vscode-eslint", "esbenp.prettier-vscode"]
    }
  },
  "forwardPorts": [3000, 5173, 5432],
  "remoteEnv": {
    "PATH": "${containerEnv:PATH}:/home/vscode/.local/bin",
    "CHECK_CMD": "pnpm verify",
    "TIMEOUT_RODADA": "45m"
  }
}
'@

Gravar "scripts/iniciar.sh" @'
#!/usr/bin/env bash
# iniciar.sh — roda DENTRO do container. Verifica o ambiente, faz o login no Claude Code
# (se necessário) e executa a primeira rodada (F0-01) com você acompanhando.
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

ok()   { echo "  [ok] $*"; }
erro() { echo "  [ERRO] $*"; exit 1; }

echo "== 1/4 Verificando ferramentas =="
command -v node   >/dev/null && ok "node $(node -v)"          || erro "node não encontrado. Reconstrua o container."
command -v pnpm   >/dev/null && ok "pnpm $(pnpm -v)"          || erro "pnpm não encontrado. Rode: corepack enable"
docker info >/dev/null 2>&1  && ok "docker disponível"        || erro "docker indisponível no container (necessário para os testes)."
if ! command -v claude >/dev/null; then
  echo "  Claude Code não encontrado. Instalando..."
  curl -fsSL https://claude.ai/install.sh | bash || erro "falha ao instalar o Claude Code."
  export PATH="$HOME/.local/bin:$PATH"
fi
ok "claude $(claude --version 2>/dev/null | head -n1)"
[ -f CLAUDE.md ] && [ -f PROGRESS.md ] && ok "CLAUDE.md e PROGRESS.md presentes" || erro "rode este script na raiz do projeto."

echo
echo "== 2/4 Login no Claude Code =="
read -r -p "Você já fez login no Claude Code neste container? (s/n) " resp
if [[ "${resp,,}" != s* ]]; then
  echo "Vou abrir o Claude Code. Faça o login seguindo as instruções na tela e depois digite /exit."
  read -r -p "Pressione Enter para continuar..." _
  claude
fi

echo
echo "== 3/4 Primeira rodada: item F0-01 =="
if grep -q -- "- \[x\] F0-01" PROGRESS.md; then
  ok "F0-01 já está concluído. Pulando."
else
  echo "O Claude Code vai abrir executando o F0-01. Acompanhe, aprove o que ele pedir e,"
  echo "quando ele disser que terminou, digite /exit para voltar a este script."
  read -r -p "Pressione Enter para começar..." _
  claude "Leia o CLAUDE.md e o PROGRESS.md e execute o item F0-01."
fi

echo
echo "== 4/4 Verificação =="
if ! grep -q -- "- \[x\] F0-01" PROGRESS.md; then
  erro "o F0-01 não foi marcado como concluído no PROGRESS.md. Rode 'claude' e peça para ele terminar o item."
fi
if pnpm verify; then
  ok "pnpm verify passou"
else
  erro "pnpm verify falhou. Rode 'claude' e peça: 'pnpm verify está falhando, corrija.'"
fi

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -q -m "F0-01: scaffold do monorepo" && ok "commit criado"
  read -r -p "Enviar para o GitHub agora? (s/n) " resp
  [[ "${resp,,}" == s* ]] && git push && ok "enviado"
fi

cat <<'FIM'

Tudo pronto. Para iniciar o desenvolvimento autônomo, rode:

  CHECK_CMD="pnpm verify" MAX_ITERACOES=4 bash autoloop.sh

Ao terminar, revise os commits e rode: git push
FIM
'@

# ---------------------------------------------------------------------------
Passo "3/4 Commit e envio ao GitHub"

$ErrorActionPreference = "Continue"
git rev-parse --is-inside-work-tree *> $null
$ehRepo = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = "Stop"
if (-not $ehRepo) { Rodar "git init" { git init -b main } }

Rodar "desativar conversão CRLF neste repositório" { git config core.autocrlf false }

$ErrorActionPreference = "Continue"
$remoto = git remote get-url origin 2>$null
$ErrorActionPreference = "Stop"
if (-not $remoto) { Rodar "adicionar remoto" { git remote add origin $RepoUrl } }
elseif ($remoto -ne $RepoUrl) { Write-Host "  [aviso] o remoto 'origin' aponta para $remoto" -ForegroundColor Yellow }
Ok "remoto origin configurado"

Rodar "git add" { git add -A }
Rodar "normalizar fins de linha" { git add --renormalize . }
Rodar "marcar scripts como executáveis" { git update-index --chmod=+x autoloop.sh scripts/iniciar.sh }

$ErrorActionPreference = "Continue"
git diff --cached --quiet
$temMudanca = ($LASTEXITCODE -ne 0)
$ErrorActionPreference = "Stop"
if ($temMudanca) {
  Rodar "commit" { git commit -m "chore: configuração do devcontainer, LF e script de início" }
  Ok "commit criado"
} else {
  Ok "nada novo para commitar"
}

Rodar "garantir branch main" { git branch -M main }

$ErrorActionPreference = "Continue"
git push -u origin main
$pushOk = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = "Stop"
if (-not $pushOk) {
  Falha "o GitHub recusou o envio porque já tem outro conteúdo. Para recomeçar limpo, use o recomecar.ps1."
}
Ok "enviado para $RepoUrl"

# ---------------------------------------------------------------------------
Passo "4/4 Abrindo no container"

$url = "vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=$RepoUrl"
Start-Process $url
Ok "VS Code chamado para clonar o repositório num volume do container"

Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Se o VS Code perguntar se pode abrir o link, confirme."
Write-Host "  2. Aguarde o build do container (alguns minutos na primeira vez)."
Write-Host "  3. No terminal do VS Code (Ctrl + crase), rode:  bash scripts/iniciar.sh"
Write-Host ""
Write-Host "Se o VS Code não abrir sozinho: Ctrl+Shift+P > 'Dev Containers: Clone Repository in Container Volume' > cole $RepoUrl"
