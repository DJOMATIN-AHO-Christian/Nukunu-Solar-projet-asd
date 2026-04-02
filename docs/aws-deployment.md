# Guide de Déploiement — AWS Free Tier
## Nukunu Solar — EC2 t2.micro (12 mois gratuits)

> Stack : EC2 t2.micro (1vCPU / 1GB RAM) + EBS 20GB + Elastic IP + Docker Compose

---

## 🆓 Ce que couvre le Free Tier AWS (12 mois)

| Service | Quota gratuit | Usage Nukunu |
|---------|--------------|-------------|
| EC2 t2.micro | 750h/mois | 1 instance = 24h/j = 720h ✅ |
| EBS gp3 | 30 GB/mois | 20 GB root volume ✅ |
| Elastic IP | Gratuit si associée | 1 EIP associée ✅ |
| Transfert réseau sortant | 100 GB/mois | Largement suffisant ✅ |
| CloudWatch | 10 métriques custom | Prometheus préféré ✅ |

> [!WARNING]
> Le Free Tier expire après **12 mois** depuis la création du compte AWS. Après, l'instance t2.micro coûte ~0.012$/h (~8.7$/mois).

---

## Prérequis

```bash
# Outils à installer en local
terraform >= 1.6
ansible >= 2.15
aws-cli >= 2.x
docker >= 24
```

### 1. Configurer les credentials AWS

```bash
# Option A — Variables d'environnement (recommandé CI/CD)
export AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export AWS_DEFAULT_REGION="eu-west-3"

# Option B — Fichier de credentials (usage local)
aws configure
```

### 2. Créer la paire de clés SSH

```bash
# Générer une clé Ed25519 (recommandé)
ssh-keygen -t ed25519 -C "nukunu-aws" -f ~/.ssh/nukunu_aws
chmod 600 ~/.ssh/nukunu_aws

# Afficher la clé publique (à copier dans terraform.tfvars)
cat ~/.ssh/nukunu_aws.pub
```

---

## 🏗️ Étape 1 — Provisionner l'infrastructure (Terraform)

```bash
cd terraform/aws

# Copier le template de variables
cp terraform.tfvars.example terraform.tfvars

# Éditer le fichier avec vos valeurs réelles
nano terraform.tfvars
```

### Contenu de `terraform.tfvars`

```hcl
# terraform/aws/terraform.tfvars (NON versionné — dans .gitignore)
aws_region     = "eu-west-3"             # Paris
instance_type  = "t2.micro"              # FREE TIER
admin_ip_cidr  = "91.165.XX.XX/32"       # Votre IP publique
key_pair_name  = "nukunu-keypair"
ssh_public_key = "ssh-ed25519 AAAAC3... nukunu-aws"
```

```bash
# Initialiser Terraform
terraform init

# Vérifier le plan
terraform plan

# Appliquer (crée VPC + EC2 + EIP)
terraform apply

# Récupérer l'IP publique
terraform output instance_public_ip
terraform output ssh_connection_string
```

> [!IMPORTANT]
> Notez l'IP Elastic affichée par `terraform output instance_public_ip`. Vous en aurez besoin pour l'inventaire Ansible.

---

## ⚙️ Étape 2 — Configurer l'inventaire Ansible

```bash
# Copier l'IP dans l'inventaire
export AWS_IP=$(cd terraform/aws && terraform output -raw instance_public_ip)

# Éditer le fichier d'inventaire
sed -i "s/<IP_ELASTIC>/$AWS_IP/" ansible/inventory/aws/hosts

# Tester la connexion SSH
ansible -i ansible/inventory/aws/hosts aws_prod -m ping \
  --private-key ~/.ssh/nukunu_aws
```

---

## 🚀 Étape 3 — Déployer l'application

```bash
# Variables d'environnement requises
export DB_PASSWORD="VotreMotDePasseSecurisé2026!"
export JWT_SECRET=$(openssl rand -hex 32)
export DOCKER_IMAGE="nukunu/solar-backend:latest"
export ALLOWED_ORIGINS="http://$AWS_IP:3002"

# Lancer le playbook complet
ansible-playbook \
  -i ansible/inventory/aws/hosts \
  ansible/playbooks/deploy_aws.yml \
  --private-key ~/.ssh/nukunu_aws \
  --extra-vars "docker_image=$DOCKER_IMAGE" \
  --extra-vars "db_password=$DB_PASSWORD" \
  --extra-vars "jwt_secret=$JWT_SECRET" \
  --extra-vars "allowed_origins=$ALLOWED_ORIGINS"
```

Le playbook effectue automatiquement :
1. ✅ Hardening OS (fail2ban, UFW, SSH sans mot de passe)
2. ✅ Installation Docker Engine (amd64)
3. ✅ Déploiement Docker Compose avec limites mémoire
4. ✅ Déploiement stack monitoring (Prometheus + Grafana)
5. ✅ Healthcheck de l'application

---

## 🔍 Vérification post-déploiement

```bash
# Tester l'application
curl http://$AWS_IP:3002/api/health

# Connexion SSH
ssh -i ~/.ssh/nukunu_aws ubuntu@$AWS_IP

# Voir les logs
docker logs nukunu-app -f

# Voir les stats mémoire (critique sur t2.micro)
docker stats --no-stream

# Voir l'utilisation du swap
free -h
```

### URLs importantes

| Service | URL | Note |
|---------|-----|------|
| Application | `http://<IP>:3002` | Accessible depuis admin_ip_cidr |
| Prometheus | `http://<IP>:9090` | Restreint à admin_ip_cidr |
| Grafana | `http://<IP>:3000` | Restreint à admin_ip_cidr |

---

## 🧠 Gestion mémoire sur t2.micro (1 GB)

Le t2.micro a **seulement 1GB de RAM**. La configuration est optimisée :

| Composant | RAM allouée | Swap max |
|-----------|------------|---------|
| OS Ubuntu | ~200 MB | — |
| Docker daemon | ~50 MB | — |
| PostgreSQL | 200 MB | 400 MB |
| Node.js app | 250 MB | 500 MB |
| Node Exporter | 50 MB | 100 MB |
| **Total** | **~750 MB** | **+ 2GB swap EBS** |

> [!TIP]
> Si l'application ralentit : `docker stats` pour identifier qui consomme. PostgreSQL et Node.js sont les principaux consommateurs. Le swap compense mais ralentit les I/O.

---

## 🔄 Pipeline CI/CD GitLab (déploiement automatique)

### Variables CI/CD à configurer dans GitLab

```
GitLab → Projet → Settings → CI/CD → Variables
```

| Variable | Valeur | Masked |
|----------|--------|--------|
| `CLOUD_TARGET` | `aws` | Non |
| `SSH_PRIVATE_KEY_AWS` | Contenu de `~/.ssh/nukunu_aws` | Oui |
| `AWS_INSTANCE_IP` | IP Elastic de l'instance | Non |
| `AWS_ACCESS_KEY_ID` | Clé AWS IAM | Oui |
| `AWS_SECRET_ACCESS_KEY` | Secret AWS IAM | Oui |
| `DB_PASSWORD` | Mot de passe PostgreSQL | Oui |
| `JWT_SECRET` | Secret JWT (32 char hex) | Oui |

```bash
# Avec CLOUD_TARGET=aws, le pipeline exécutera :
# lint → build (amd64) → trivy scan → deploy_aws_staging
```

---

## 💰 Estimation des coûts après Free Tier

| Service | Prix/mois | Note |
|---------|-----------|------|
| EC2 t2.micro | ~8.47 € | On-demand Paris |
| EBS 20GB gp3 | ~1.62 € | 0.0812€/GB/mois |
| Elastic IP | 0 € | Gratuite si associée |
| **Total** | **~10 €/mois** | Très abordable |

> Alternative économique après Free Tier : migrer vers **t3a.micro** (~6.5€/mois) ou revenir vers **OCI ARM Ampere A1** (always free, 4 vCPUs, 24 GB RAM).

---

## 🗑️ Détruire l'infrastructure (économiser les coûts)

```bash
cd terraform/aws

# ATTENTION : supprime TOUTES les ressources AWS
terraform destroy

# Vérifier que tout est supprimé
aws ec2 describe-instances --region eu-west-3
```
