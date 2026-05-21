#!/usr/bin/env bash
# ==============================================================================
# provision-web.sh
# Description : Configure le serveur Linux (Ubuntu) avec les prérequis système
#               nécessaires pour exécuter l'application Nukunu Solar (Docker).
# Usage       : sudo bash provision-web.sh
# Auteur      : Candidat ASD — Mai 2026
# ==============================================================================

# Arrêt immédiat en cas d'erreur, variable non définie, ou échec dans un pipe
set -euo pipefail

# Journalisation horodatée
LOG_FILE="/var/log/provision-nukunu.log"
exec > >(tee -a "$LOG_FILE") 2>&1

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "=== Début du provisionnement de l'hôte Docker ==="

# Vérification des droits root
if [[ $EUID -ne 0 ]]; then
    log "ERREUR: Ce script doit être exécuté en root (sudo)."
    exit 1
fi

APP_USER="nukunu_admin"

# ==========================================
# 1. Création de l'utilisateur applicatif (Idempotence)
# ==========================================
if ! id "$APP_USER" &>/dev/null; then
    log "Création de l'utilisateur système $APP_USER..."
    useradd --system --create-home --shell /bin/bash "$APP_USER"
    usermod -aG docker "$APP_USER" 2>/dev/null || true # Au cas où docker n'est pas encore installé
else
    log "L'utilisateur $APP_USER existe déjà (ignoré)."
fi

# ==========================================
# 2. Mise à jour système et installation des dépendances
# ==========================================
export DEBIAN_FRONTEND=noninteractive
log "Mise à jour des dépôts..."
apt-get update -qq
log "Installation des paquets de base (curl, git, ufw, fail2ban)..."
apt-get install -y -qq curl git ufw fail2ban apt-transport-https ca-certificates software-properties-common

# ==========================================
# 3. Installation de Docker (si non présent)
# ==========================================
if ! command -v docker &> /dev/null; then
    log "Installation de Docker..."
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
    add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" -y
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    usermod -aG docker "$APP_USER"
else
    log "Docker est déjà installé (ignoré)."
fi

# ==========================================
# 4. Configuration du Pare-feu (UFW)
# ==========================================
log "Configuration stricte du pare-feu (UFW)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp  comment 'Accès SSH Administrateur'
ufw allow 80/tcp  comment 'HTTP (Reverse Proxy Nginx)'
ufw allow 443/tcp comment 'HTTPS (Reverse Proxy Nginx)'
ufw --force enable

# ==========================================
# 5. Configuration Fail2Ban
# ==========================================
log "Activation de Fail2Ban pour la protection SSH..."
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# ==========================================
# 6. Vérifications finales post-déploiement
# ==========================================
log "=== Vérification de la conformité ==="
systemctl is-active --quiet docker && log "[OK] Service Docker actif." || { log "[ERREUR] Docker inactif."; exit 1; }
ufw status | grep -q "Status: active" && log "[OK] Pare-feu actif." || { log "[ERREUR] UFW inactif."; exit 1; }

log "=== Provisionnement terminé avec succès ==="
exit 0
