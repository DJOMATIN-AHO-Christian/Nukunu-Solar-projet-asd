# ════════════════════════════════════════════════════════════
# Outputs — Infrastructure AWS Free Tier
# Nukunu Solar
# ════════════════════════════════════════════════════════════

output "instance_public_ip" {
  description = "IP publique Elastic IP du serveur Nukunu sur AWS"
  value       = aws_eip.nukunu_eip.public_ip
}

output "instance_public_dns" {
  description = "DNS public de l'instance EC2"
  value       = aws_instance.nukunu_server.public_dns
}

output "ssh_connection_string" {
  description = "Commande SSH pour se connecter au serveur"
  value       = "ssh -i ~/.ssh/nukunu_aws ubuntu@${aws_eip.nukunu_eip.public_ip}"
}

output "free_tier_summary" {
  description = "Résumé de la consommation Free Tier"
  value = {
    instance_type  = var.instance_type
    region         = var.aws_region
    ebs_gb         = 20
    eip_allocated  = true
    free_tier_note = "t2.micro = 750h/mois gratuites pendant 12 mois. EBS gp3 = 30GB gratuits."
  }
}

output "application_url" {
  description = "URL de l'application Nukunu Solar"
  value       = "http://${aws_eip.nukunu_eip.public_ip}:3002"
}

output "ansible_inventory_entry" {
  description = "Entrée à copier dans ansible/inventory/aws/hosts"
  value       = "nukunu-aws ansible_host=${aws_eip.nukunu_eip.public_ip} ansible_user=ubuntu"
}
