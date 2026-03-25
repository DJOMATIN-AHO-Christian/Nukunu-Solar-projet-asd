variable "tenancy_ocid" {
  description = "OCID du Tenancy Oracle Cloud"
  type        = string
}

variable "user_ocid" {
  description = "OCID de l'utilisateur Oracle Cloud"
  type        = string
}

variable "fingerprint" {
  description = "Empreinte de la clé API Oracle"
  type        = string
}

variable "private_key_path" {
  description = "Chemin vers la clé privée API Oracle"
  type        = string
}

variable "region" {
  description = "Région Oracle (ex: eu-paris-1)"
  type        = string
  default     = "eu-paris-1"
}

variable "compartment_id" {
  description = "OCID du compartment où déployer les ressources"
  type        = string
}

variable "ssh_public_key" {
  description = "Clé publique SSH (Ed25519 de préférence) pour accéder au master"
  type        = string
}

variable "bastion_ip" {
  description = "Votre IP publique pour limiter l'accès SSH (laisser vide pour autoriser tout le monde temporairement)"
  type        = string
  default     = ""
}
