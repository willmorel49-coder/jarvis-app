#!/usr/bin/env bash
# Attend que la nouvelle version soit RÉELLEMENT servie en prod (GitHub Pages).
# Évite d'annoncer « c'est en ligne » avant que ce soit vrai (friction n°1 de Will).
# Usage : bash scripts/attendre-prod.sh <token ?v=>   (ex : bash scripts/attendre-prod.sh 20260710c)
set -e
TOKEN="${1:?Usage: attendre-prod.sh <token ?v=, ex 20260710c>}"
URL="https://willmorel49-coder.github.io/jarvis-app/crm/v2/index.html"
echo "⏳ Attente de la version $TOKEN en prod (max ~3 min)…"
for i in $(seq 1 18); do            # 18 × 10s ≈ 3 min
  if curl -fsS "$URL" 2>/dev/null | grep -q "$TOKEN"; then
    echo "✅ Version $TOKEN servie en prod."
    echo "🔗 $URL"
    exit 0
  fi
  sleep 10
done
echo "⚠️ Version $TOKEN pas encore vue après 3 min (GitHub Pages parfois lent)."
echo "   Réessaie le refresh dans 1-2 min — ou vérifie le déploiement Pages."
exit 1
