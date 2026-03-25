#!/bin/bash
# ════════════════════════════════════════════════════════════
# Nukunu Solar - Script de Provisionnement VM (Idempotent)
# ASD Certification - Infrastructure Setup
# ════════════════════════════════════════════════════════════

set -euo pipefail

LOG_FILE="/var/log/nukunu-provision.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "[$(date)] --- DÉBUT DU PROVISIONNEMENT ---"

# 1. Mise à jour du système
echo "Mise à jour des dépôts..."
sudo apt-get update -y

# 2. Installation de Docker (si absent)
if ! command -v docker &> /dev/null; then
    echo "Installation de Docker..."
    sudo apt-get install -y docker.io docker-compose
    sudo usermod -aG docker $USER
else
    echo "Docker est déjà installé."
fi

# 3. Installation de K3s (si absent)
if ! command -v k3s &> /dev/null; then
    echo "Installation de K3s..."
    curl -sfL https://get.k3s.io | sh -
else
    echo "K3s est déjà installé."
fi

# 4. Configuration des limites système
echo "Optimisation des limites système..."
echo "fs.file-max = 100000" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

echo "[$(date)] --- PROVISIONNEMENT TERMINÉ ---"
