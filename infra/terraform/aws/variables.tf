# ════════════════════════════════════════════════════════════
# Variables — Infrastructure AWS Free Tier
# Nukunu Solar
# ════════════════════════════════════════════════════════════

variable "aws_region" {
  description = "Région AWS de déploiement (ex: eu-west-3 pour Paris)"
  type        = string
  default     = "eu-west-3"
}

variable "instance_type" {
  description = "Type d'instance EC2 (t2.micro = FREE TIER 12 mois)"
  type        = string
  default     = "t2.micro" # 1 vCPU, 1GB RAM — 750h/mois gratuites

  validation {
    condition     = contains(["t2.micro", "t3.micro", "t3a.micro"], var.instance_type)
    error_message = "Pour rester dans le Free Tier, utiliser t2.micro, t3.micro ou t3a.micro."
  }
}

variable "ssh_public_key" {
  description = "Clé publique SSH (Ed25519 recommandé) pour accéder au serveur"
  type        = string
}

variable "key_pair_name" {
  description = "Nom du Key Pair AWS à créer"
  type        = string
  default     = "nukunu-keypair"
}

variable "admin_ip_cidr" {
  description = "CIDR de l'IP autorisée pour SSH et les ports d'admin (ex: 1.2.3.4/32)"
  type        = string

  validation {
    condition     = can(cidrhost(var.admin_ip_cidr, 0))
    error_message = "admin_ip_cidr doit être un CIDR valide (ex: 91.165.12.34/32)."
  }
}

variable "db_password" {
  description = "Mot de passe PostgreSQL (injecté via variable d'env, ne pas coder en dur)"
  type        = string
  sensitive   = true
  default     = ""
}
