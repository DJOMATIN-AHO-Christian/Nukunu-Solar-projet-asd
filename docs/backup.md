# Stratégie de Sauvegarde (Backup) — Nukunu Solar

> Documentation de la stratégie de sauvegarde pour la conformité **BC02-CP2** (Maintien de l'intégrité et disponibilité des données)

---

## 1. Objectifs (RPO et RTO)

La criticité de la plateforme Nukunu Solar impose des objectifs clairs de reprise en cas de sinistre :
- **RPO (Recovery Point Objective)** : 24 heures. En cas de crash total, la perte de données maximale tolérée est de 24h.
- **RTO (Recovery Time Objective)** : 4 heures. Le temps de restauration du service complet ne doit pas excéder 4h.

---

## 2. Emplacement et méthodes

### La Base de Données (PostgreSQL)
La base de données tourne via Docker avec un volume Docker persistant (`pgdata`).
- Un script de sauvegarde automatique [`scripts/provision/backup-db.sh`](../scripts/provision/backup-db.sh) est déployé sur le serveur de production.
- **Action** : Réalise un `pg_dump` compressé de l'ensemble de la base.
- **Conservation (Rétention)** : Les backups sont conservés localement pendant **7 jours**. Les sauvegardes plus anciennes sont automatiquement purgées par le script pour économiser de l'espace disque.

En production, ces backups sont expédiés vers un pont de stockage objet (AWS S3 ou OCI Object Storage) sécurisé et indépendant de la région principale.

### Code source & Images Docker
Le RTO est garanti par l'Infrastructure as Code (IaC) et la CI/CD :
- Le code applicatif et les playbooks Ansible/fichiers Terraform sont hébergés sur GitLab et GitHub.
- L'image Docker est stockée de manière immuable sur un registre Docker privé, prête à être redéployée si l'instance venait à être détruite.

---

## 3. Déploiement automatisé du Cron (Ansible)

La sauvegarde de la base de données s'exécute automatiquement **toute les nuits à 03h00** via une tâche intégrée au playbook d'installation (`ansible/playbooks/docker.yml`).

Voici la tâche de déploiement qui implémente le Cron job :
```yaml
- name: "BC02-CP2 — Configurer le cron de backup PostgreSQL (Chaque nuit à 03:00)"
  cron:
    name: "Nukunu Daily DB Backup"
    minute: "0"
    hour: "3"
    user: "{{ app_user }}"
    job: "/opt/nukunu/scripts/backup-db.sh >> /opt/nukunu/backups/cron.log 2>&1"
```

## 4. Procédure de restauration (Disaster Recovery)

Si la base venait à être corrompue, un script de restauration ou des commandes manuelles valident le RTO :

```bash
# 1. Arrêt de l'application
docker start nukunu-postgres
docker stop nukunu-app

# 2. Suppression de la base corrompue
docker exec nukunu-postgres dropdb -U nukunu_admin nukunu_solar

# 3. Création d'une nouvelle base vierge
docker exec nukunu-postgres createdb -U nukunu_admin nukunu_solar

# 4. Injection de la dernière sauvegarde
zcat /opt/nukunu/backups/db_backup_20261015_030000.sql.gz | docker exec -i nukunu-postgres psql -U nukunu_admin -d nukunu_solar

# 5. Redémarrage de l'app
docker start nukunu-app
```
Ce processus assure une restauration complète du système sous la limite des 4 heures, justifiant notre conformité en maintien conditionnel.
