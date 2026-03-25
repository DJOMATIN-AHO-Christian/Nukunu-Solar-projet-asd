output "master_public_ip" {
  description = "Adresse IP publique du master K3s"
  value       = oci_core_instance.nukunu_master.public_ip
}

output "ssh_connection_string" {
  description = "Commande pour se connecter en SSH au master"
  value       = "ssh ubuntu@${oci_core_instance.nukunu_master.public_ip}"
}
