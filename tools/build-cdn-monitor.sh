#!/usr/bin/env bash
# Gera a versão do Monitor Brasil 2027-2030 para os membros do CDN (site Netlify separado do CA Hub).
# Fonte única: monitor-brasil/index.html e monitor-brasil/dados.json. Rode sempre antes de publicar o site do CDN.
set -euo pipefail
cd "$(dirname "$0")/.."
src=monitor-brasil; out=cdn-monitor
cp "$src/dados.json" "$out/dados.json"
sed -e 's#<b>CA</b> Inteligência · Monitor de risco político e regulatório#<b>CDN</b> Círculo Diplomático de Negócios · Monitor de risco político e regulatório#' \
    -e 's#Todo dia 25, com resumo enviado por e-mail à CA\.#Todo dia 25, com live de balanço na comunidade do CDN.#' \
    -e 's#CA Consultoria Internacional · Monitor Brasil 2027-2030 · uso interno e de clientes#CDN · Círculo Diplomático de Negócios · por CA Consultoria Internacional · exclusivo para membros · <a href="/__sair">Sair</a>#' \
    -e 's#<title>Monitor Brasil 2027-2030</title>#<title>Monitor Brasil 2027-2030 · CDN</title>#' \
    "$src/index.html" > "$out/index.html"
for s in '<b>CDN</b> Círculo' 'live de balanço na comunidade' 'exclusivo para membros'; do
  grep -q "$s" "$out/index.html" || { echo "ERRO: trecho não aplicado: $s" >&2; exit 1; }
done
echo "cdn-monitor gerado a partir de $src ($(date -u +%FT%TZ))"
