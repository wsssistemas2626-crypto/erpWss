# recomecar.ps1 — recomeça o ambiente do erpWss do zero
#
# ATENÇÃO: este script é destrutivo, e pede confirmação antes de agir.
#   - apaga a pasta local do projeto (erpWss) e recria a partir do zip
#   - apaga os containers e volumes Docker criados para o erpWss
#   - SOBRESCREVE o conteúdo do repositório no GitHub com o kit limpo
#
# Como usar:
#   1. Feche TODAS as janelas do VS Code.
#   2. Coloque este script e o erp-kit.zip na mesma pasta (ex.: C:\Users\server\Documents\sistemas).
#   3. Abra o PowerShell nessa pasta e rode:
#        powershell -ExecutionPolicy Bypass -File .\recomecar.ps1

param(
  [string]$Zip     = ".\erp-kit.zip",
  [string]$Pasta   = ".\erpWss",
  [string]$RepoUrl = "https://github.com/wsssistemas2626-crypto/erpWss.git"
)

$ErrorActionPreference = "Stop"
function Passo($t) { Write-Host ""; Write-Host "== $t ==" -ForegroundColor Cyan }
function Ok($t)    { Write-Host "  [ok] $t" -ForegroundColor Green }
function Aviso($t) { Write-Host "  [aviso] $t" -ForegroundColor Yellow }
function Falha($t) { Write-Host "  [ERRO] $t" -ForegroundColor Red; exit 1 }
function Rodar([string]$descricao, [scriptblock]$bloco) {
  $ErrorActionPreference = "Continue"
  & $bloco
  if ($LASTEXITCODE -ne 0) { Falha "$descricao (código $LASTEXITCODE)" }
}

# ---------------------------------------------------------------------------
Passo "0/5 Conferências"

if (-not (Test-Path $Zip)) { Falha "não encontrei $Zip nesta pasta. Coloque o erp-kit.zip aqui e rode de novo." }
foreach ($c in "git", "docker") {
  if (-not (Get-Command $c -ErrorAction SilentlyContinue)) { Falha "$c não encontrado no PATH." }
}
$ErrorActionPreference = "Continue"; docker info *> $null; $dockerOk = ($LASTEXITCODE -eq 0); $ErrorActionPreference = "Stop"
if (-not $dockerOk) { Falha "o Docker Desktop não está rodando. Abra-o, espere 'Engine running' e rode de novo." }
if (Get-Process -Name "Code" -ErrorAction SilentlyContinue) { Falha "o VS Code está aberto. Feche todas as janelas dele e rode de novo." }
Ok "zip, git e docker prontos; VS Code fechado"

$pastaAbs = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Pasta))
Write-Host ""
Write-Host "Este script vai:" -ForegroundColor Yellow
Write-Host "  - APAGAR a pasta $pastaAbs e recriá-la a partir do zip"
Write-Host "  - APAGAR containers e volumes Docker do erpWss"
Write-Host "  - SOBRESCREVER o repositório $RepoUrl com o kit limpo"
$conf = Read-Host "Digite SIM para continuar"
if ($conf -ne "SIM") { Write-Host "Cancelado."; exit 0 }

# ---------------------------------------------------------------------------
Passo "1/5 Limpando Docker"

$ErrorActionPreference = "Continue"
$conts = docker ps -aq --filter "label=vsch.local.repository=$RepoUrl"
if ($conts) { docker rm -f $conts | Out-Null; Ok "containers do erpWss removidos" } else { Ok "nenhum container do erpWss" }
docker container prune -f | Out-Null
Ok "containers parados removidos"
$todos = @(docker volume ls --format "{{.Name}}")
$vols = @($todos | Where-Object { $_ -match "(?i)^erpwss" })
if ($vols.Count -gt 0) {
  foreach ($v in $vols) {
    docker volume rm -f $v | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok "volume removido: $v" } else { Aviso "não consegui remover o volume $v (feche o VS Code e rode de novo)" }
  }
} else {
  Ok "nenhum volume do erpWss (volumes existentes: $($todos -join ', '))"
}
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
Passo "2/5 Recriando a pasta local a partir do zip"

if (Test-Path $pastaAbs) { Remove-Item $pastaAbs -Recurse -Force; Ok "pasta antiga apagada" }
$tmp = Join-Path $env:TEMP ("erpkit-" + [guid]::NewGuid().ToString("N"))
Expand-Archive -Path $Zip -DestinationPath $tmp -Force
$claude = Get-ChildItem -Path $tmp -Recurse -Filter "CLAUDE.md" | Select-Object -First 1
if (-not $claude) { Remove-Item $tmp -Recurse -Force; Falha "o zip não contém CLAUDE.md. Baixe o erp-kit.zip de novo." }
Move-Item -Path $claude.Directory.FullName -Destination $pastaAbs
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
Set-Location $pastaAbs
foreach ($f in "CLAUDE.md", "PROGRESS.md", ".devcontainer\devcontainer.json", ".gitattributes", "autoloop.sh", "scripts\iniciar.sh") {
  if (-not (Test-Path $f)) { Falha "faltando $f na raiz. Baixe o erp-kit.zip mais recente." }
}
Ok "kit extraído na raiz de $pastaAbs"

# ---------------------------------------------------------------------------
Passo "3/5 Criando o repositório git limpo"

$nome = (git config --global user.name); $email = (git config --global user.email)
if (-not $nome)  { $nome  = Read-Host "  Seu nome para os commits";  Rodar "configurar nome"   { git config --global user.name  "$nome" } }
if (-not $email) { $email = Read-Host "  Seu e-mail para os commits"; Rodar "configurar e-mail" { git config --global user.email "$email" } }

Rodar "git init" { git init -b main }
Rodar "autocrlf" { git config core.autocrlf false }
Rodar "git add" { git add -A }
Rodar "scripts executáveis" { git update-index --chmod=+x autoloop.sh scripts/iniciar.sh }
Rodar "commit" { git commit -q -m "docs: kit inicial do ERP" }
Rodar "remoto" { git remote add origin $RepoUrl }
Ok "commit inicial criado"

# ---------------------------------------------------------------------------
Passo "4/5 Enviando ao GitHub (sobrescrevendo)"

Rodar "push" { git push --force -u origin main }
Ok "GitHub agora contém apenas o kit limpo"

# ---------------------------------------------------------------------------
Passo "5/5 Abrindo no container"

Start-Process "vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=$RepoUrl"
Ok "VS Code chamado para clonar o repositório num volume novo"

Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Se o navegador/Windows perguntar se pode abrir o VS Code, confirme."
Write-Host "  2. Aguarde o build (canto inferior esquerdo mostrará 'Dev Container: erp-autoloop')."
Write-Host "  3. Menu Terminal > New Terminal, e rode:  bash scripts/iniciar.sh"
