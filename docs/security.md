# Sécurité Infrastructure — Nukunu Solar

> Documentation de la posture de sécurité pour la conformité **BC01-CP3** (REAC Administrateur cloud et DevOps)

---

## 1. Contrôle d'accès réseau (AWS / Terraform)

### Règles de firewall — Security Groups AWS

Le fichier [`infra/terraform/aws/main.tf`](../infra/terraform/aws/main.tf) définit des règles d'accès strictes :

| Port | Protocole | Source autorisée | Justification |
|------|-----------|-----------------|---------------|
| 22 (SSH) | TCP | `var.admin_ip_cidr` (ex: `1.2.3.4/32`) | Restreint à l'IP de l'administrateur uniquement |
| 80 (HTTP) | TCP | `0.0.0.0/0` | Trafic web public |
| 3002 (App) | TCP | `var.admin_ip_cidr` | Interface d'administration Nukunu Solar restreinte |

> [!IMPORTANT]
> Le port SSH **n'est pas ouvert sur `0.0.0.0/0`**. La variable `admin_ip_cidr` est définie dans `terraform.tfvars` (non versionné) et injectée au provisionnement. Ce fichier ne contient **aucune donnée sensible**.

### Résilience et Base de Données

Actuellement, l'architecture d'hébergement est de type "Single Node" ce qui implique que la base de données PostgreSQL fonctionne sur la même instance que l'application et partage le même réseau.
Cependant, son port (5432) n'est **jamais exposé sur internet**. L'accès est strictement cantonné au réseau conteneurisé Docker/K3s et protégé au niveau OS/Cloud par UFW et les Security Lists qui rejettent tout accès externe sur ce port. En phase de production Entreprise, la BDD sera isolée dans un CIDR de sous-réseau privé.

### Paramétrage de la variable SSH

```hcl
# terraform/variables.tf
variable "admin_ip_cidr" {
  description = "CIDR de l'IP autorisée à administrer le nœud (ex: 1.2.3.4/32)"
  type        = string
}
```

```bash
# Utilisation — terraform.tfvars (NON versionné, dans .gitignore)
admin_ip_cidr = "91.165.xx.xx/32"  # IP de l'administrateur
```

---

## 2. Hardening système (Ansible & User Data)

Le déploiement via [`infra/ansible/playbooks/deploy_aws.yml`](../infra/ansible/playbooks/deploy_aws.yml) applique automatiquement :

### Gestion des accès SSH
```yaml
# Désactivation de l'authentification par mot de passe
PasswordAuthentication no
# Désactivation de la connexion root directe
PermitRootLogin no
```

- ✅ Seul l'utilisateur `deploy` avec **clé Ed25519** peut se connecter
- ✅ `authorized_key` Ansible gère l'injection de la clé publique

### Pare-feu UFW (couche OS)

Double protection : OCI Security Lists (couche réseau) **+** UFW (couche OS) :

```yaml
# UFW — ports ouverts sur l'instance
- '22'    # SSH (filtré en amont par AWS Security Group)
- '80'    # HTTP
- '3002'  # Nukunu App API
- '3000'  # Grafana Monitoring
```
Politique par défaut : **DENY** (tout bloquer sauf les ports listés)

### fail2ban

Le package `fail2ban` est installé via `base.yml`. Il protège contre les attaques par force brute sur SSH en bannissant automatiquement les IPs qui échouent 3 tentatives.

---

## 3. Gestion des secrets

| Secret | Mécanisme |
|--------|-----------|
| Clés AWS (Access Keys) | Stockées localement (~/.aws/credentials) |
| SSH Private Key (CI/CD) | GitHub Secret `SSH_PRIVATE_KEY` |
| JWT_SECRET (backend) | GitHub Secret `JWT_SECRET` -> .env production |
| Mot de passe PostgreSQL | GitHub Secret `DB_PASSWORD` -> .env production |
| Mot de passe Grafana | Variable d'environnement sécurisée |

---

## 4. Pipeline CI/CD — Sécurité (GitHub Actions)

La pipeline de déploiement [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) intègre :

- **Linting** (Qualité)
- **Trivy Scan** (Analyse vulnérabilités) :
  ```yaml
  - name: Run Trivy vulnerability scanner
    uses: aquasecurity/trivy-action@master
    with:
      image-ref: 'nukunu-solar-backend:test'
      severity: 'CRITICAL,HIGH'
  ```
- **Tests E2E** (Validation fonctionnelle)

---

## 5. Conformité REAC BC01-CP3

| Exigence CP3 | Implémentation | Fichier de preuve |
|---|---|---|
| Sécurisation des accès SSH | `PermitRootLogin no` + auth par clé | `infra/ansible/playbooks/deploy_aws.yml` |
| Firewall réseau | AWS Security Groups + UFW | `infra/terraform/aws/main.tf` |
| Restriction IP administration | `var.admin_ip_cidr` pour SSH | `infra/terraform/aws/main.tf` |
| Protection anti-brute-force | fail2ban installé et activé | `infra/ansible/playbooks/deploy_aws.yml` |
| Scan de vulnérabilités | Trivy dans GitHub Actions | `.github/workflows/deploy.yml` |
| Gestion des secrets | GitHub Secrets (Action env) | `.github/workflows/deploy.yml` |
| Stratégie de Sauvegarde | Scripts automatises + Cron (BC02-CP2) | [`docs/backup.md`](backup.md) |
| Idempotence provisioning | Checks grep dans User Data | [`infra/terraform/aws/main.tf`](../infra/terraform/aws/main.tf) |
