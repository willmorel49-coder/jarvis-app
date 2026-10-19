#!/usr/bin/env bash
# Attend que la nouvelle version soit RÉELLEMENT servie en prod (GitHub Pages).
# Évite d'annoncer « c'est en ligne » avant que ce soit vrai (friction n°1 de Will).
# Usage : bash scripts/attendre-prod.sh <token ?v=>   (ex : bash scripts/attendre-prod.sh 20260710c)
set -e
TOKEN="${1:?Usage: attendre-prod.sh <token ?v=, ex 20260710c>}"
URL="https://willmorel49-coder.github.io/jarvis-app/crm/v2/index.html"
# Depuis le 19/10/2026 la publication attend que les tests soient verts (ci.yml) :
# compter ~3 min, davantage si une autre publication passe juste avant.
echo "⏳ Attente de la version $TOKEN en prod (max ~8 min)…"
for i in $(seq 1 48); do            # 48 × 10s ≈ 8 min
  if curl -fsS "$URL" 2>/dev/null | grep -q "$TOKEN"; then
    echo "✅ Version $TOKEN servie en prod."
    echo "🔗 $URL"
    exit 0
  fi
  sleep 10
done
echo "⚠️ Version $TOKEN pas encore vue après 8 min."
echo "   Un test a peut-être échoué (la mise en ligne est alors bloquée) :"
echo "   gh run list -R willmorel49-coder/jarvis-app -w ci.yml -L 3"
exit 1
