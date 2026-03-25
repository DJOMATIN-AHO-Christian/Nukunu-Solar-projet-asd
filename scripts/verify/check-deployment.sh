#!/bin/bash
# ════════════════════════════════════════════════════════════
# Nukunu Solar - Script de Vérification Post-Déploiement
# ASD Certification - Deployment Healthcheck
# ════════════════════════════════════════════════════════════

set -euo pipefail

API_URL="http://localhost:3002/api/health"

echo "Vérification de l'état du déploiement..."

# 1. Vérification de la connectivité API
echo "Test de l'endpoint Healthceck ($API_URL)..."
if curl -s -f "$API_URL" | grep -q '"ok":true'; then
    echo "✅ API: Opérationnelle"
else
    echo "❌ API: Échec du healthcheck"
    exit 1
fi

# 2. Vérification des conteneurs
echo "Vérification des conteneurs Docker..."
if docker ps | grep -q "nukunu-app"; then
    echo "✅ Docker: Conteneur nukunu-app en cours d'exécution"
else
    echo "❌ Docker: Conteneur nukunu-app absent ou arrêté"
    exit 1
fi

# 3. Vérification de la base de données
echo "Vérification de la connectivité DB..."
if docker exec nukunu-app nc -z nukunu-db 5432; then
    echo "✅ DB: Connectivité réseau validée"
else
    echo "❌ DB: Impossible de joindre la base de données"
    exit 1
fi

echo "--- TOUS LES TESTS SONT AU VERT ---"
