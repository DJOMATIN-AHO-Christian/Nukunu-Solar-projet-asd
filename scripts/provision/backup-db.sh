#!/bin/bash
# ════════════════════════════════════════════════════════════
# Nukunu Solar — Script de Sauvegarde PostgreSQL
# Exécution via Cron (Ansible)
# BC02-CP2 : Stratégie de sauvegarde et conservation des données
# ════════════════════════════════════════════════════════════

set -euo pipefail

# Configuration
BACKUP_DIR="/opt/nukunu/backups"
DB_CONTAINER="nukunu-postgres"
DB_USER="nukunu_admin"
DB_NAME="nukunu_solar"
RETENTION_DAYS=7
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/db_backup_${DATE}.sql.gz"

# Création du dossier si inexistant
mkdir -p "${BACKUP_DIR}"

echo "Début de la sauvegarde de la base de données : ${DB_NAME}"

# Dump de la base de données depuis le conteneur Docker, avec compression à la volée
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"

echo "✅ Sauvegarde terminée : ${BACKUP_FILE}"

# Rotation : suppression des backups vieux de plus de RETENTION_DAYS jours
echo "Rotation des anciennes sauvegardes (Rétention = ${RETENTION_DAYS} jours)"
find "${BACKUP_DIR}" -type f -name "db_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -exec rm -f {} \;

echo "✅ Nettoyage terminé."

# (Optionnel) Envoi vers un stockage S3 / OCI Object Storage
# aws s3 cp "${BACKUP_FILE}" s3://nukunu-backups/db/
# oci os object put -bn nukunu-backups --file "${BACKUP_FILE}" --name "db/${DATE}.sql.gz"
