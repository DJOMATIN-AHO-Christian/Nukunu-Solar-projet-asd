#!/usr/bin/env bash
# ==============================================================================
# smoke-test.sh
# Description : Exécute des tests de base pour s'assurer que l'environnement de
#               test isolé a démarré correctement avant tout déploiement en prod.
#               (BC02-CP5)
# Usage       : bash smoke-test.sh
# Auteur      : Candidat ASD — Mai 2026
# ==============================================================================

set -euo pipefail

# Paramètres
TARGET_URL="http://localhost:3002/api/health" # Port exposé dans l'environnement de test
MAX_RETRIES=10
RETRY_DELAY=3

echo "=== Début des Smoke Tests (Environnement Isolé) ==="

# Attente que le service réponde
echo "Attente de la disponibilité de l'API sur $TARGET_URL..."
for ((i=1; i<=MAX_RETRIES; i++)); do
    # Vérifie si on reçoit un HTTP 200
    if curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL" | grep -q "200"; then
        echo "✅ [SUCCESS] L'API a répondu avec succès (HTTP 200)."
        exit 0
    fi
    echo "🔄 Tentative $i/$MAX_RETRIES : Le service n'est pas encore prêt..."
    sleep "$RETRY_DELAY"
done

echo "❌ [ERREUR] Timeout : L'API n'a pas répondu correctement après $((MAX_RETRIES * RETRY_DELAY)) secondes."
echo "L'environnement de test est défaillant. Interruption du pipeline CI/CD."
exit 1
