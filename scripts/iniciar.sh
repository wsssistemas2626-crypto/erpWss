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
