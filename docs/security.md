# Sécurité Infrastructure — Nukunu Solar

> Documentation de la posture de sécurité pour la conformité **BC01-CP3** (REAC Administrateur cloud et DevOps)

---

## 1. Contrôle d'accès réseau (OCI / Terraform)

### Règles de firewall — Security Lists OCI

Le fichier [`terraform/main.tf`](../terraform/main.tf) définit des règles d'accès strictes :

| Port | Protocole | Source autorisée | Justification |
|------|-----------|-----------------|---------------|
| 22 (SSH) | TCP | `var.admin_ip_cidr` (ex: `1.2.3.4/32`) | Restreint à l'IP de l'administrateur uniquement |
| 80 (HTTP) | TCP | `0.0.0.0/0` | Trafic web public — redirigé vers HTTPS |
| 443 (HTTPS) | TCP | `0.0.0.0/0` | Trafic applicatif chiffré |
| 6443 (K3s API) | TCP | `var.admin_ip_cidr` | API Kubernetes restreinte à l'admin |

> [!IMPORTANT]
> Le port SSH **n'est pas ouvert sur `0.0.0.0/0`**. La variable `admin_ip_cidr` est définie dans `terraform.tfvars` (non versionné) et injectée au provisionnement. Ce fichier ne contient **aucune donnée sensible**.

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

## 2. Hardening système (Ansible)

Le playbook [`ansible/playbooks/base.yml`](../ansible/playbooks/base.yml) applique automatiquement :

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
- '22'    # SSH (couche OCI filtre déjà par IP)
- '80'    # HTTP
- '443'   # HTTPS
- '6443'  # K3s API
```
Politique par défaut : **REJECT** (tout bloquer sauf les ports listés)

### fail2ban

Le package `fail2ban` est installé via `base.yml`. Il protège contre les attaques par force brute sur SSH en bannissant automatiquement les IPs qui échouent 3 tentatives.

---

## 3. Gestion des secrets

| Secret | Mécanisme |
|--------|-----------|
| Clés API OCI (tenancy_ocid, fingerprint...) | Variables Terraform — `terraform.tfvars` dans `.gitignore` |
| SSH Private Key (pipeline CI/CD) | Variable CI/CD GitLab `$SSH_PRIVATE_KEY` (masked + protected) |
| JWT_SECRET (backend) | Variable d'environnement Docker — jamais en clair dans le code |
| Mot de passe PostgreSQL | Variable d'environnement Docker Compose |
| Mot de passe Grafana Admin | Variable d'environnement + Ansible Vault (en production) |

---

## 4. Pipeline CI/CD — Scan de sécurité (Trivy)

Le stage `security_scan` dans [`.gitlab-ci.yml`](../.gitlab-ci.yml) analyse l'image Docker avant tout déploiement :

```yaml
security_scan:
  image: aquasec/trivy:latest
  script:
    - trivy image --severity HIGH,CRITICAL --exit-code 1 $DOCKER_IMAGE
```

- Si des vulnérabilités **HIGH** ou **CRITICAL** sont détectées → **pipeline bloqué**
- Aucune image vulnérable ne peut atteindre la production

---

## 5. Conformité REAC BC01-CP3

| Exigence CP3 | Implémentation | Fichier de preuve |
|---|---|---|
| Sécurisation des accès SSH | `PermitRootLogin no` + auth par clé | `ansible/playbooks/base.yml` |
| Firewall réseau | OCI Security Lists + UFW | `terraform/main.tf` |
| Restriction IP administration | `var.admin_ip_cidr` pour SSH et K3s | `terraform/main.tf` |
| Protection anti-brute-force | fail2ban installé et activé | `ansible/playbooks/base.yml` |
| Scan de vulnérabilités | Trivy dans CI/CD | `.gitlab-ci.yml` |
| Gestion des secrets | Variables CI/CD masquées, .gitignore | `.gitignore` |
