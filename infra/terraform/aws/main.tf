# ════════════════════════════════════════════════════════════
# Terraform — Infrastructure AWS Free Tier
# Nukunu Solar — Alternative déploiement Amazon EC2
# Resources : EC2 t2.micro + EBS 30GB + Security Group + VPC
# ════════════════════════════════════════════════════════════

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend S3 optionnel (commenter pour usage local)
  # backend "s3" {
  #   bucket = "nukunu-terraform-state"
  #   key    = "prod/terraform.tfstate"
  #   region = var.aws_region
  # }
}

provider "aws" {
  region = var.aws_region
  # Les credentials sont lus depuis les variables d'env :
  # AWS_ACCESS_KEY_ID et AWS_SECRET_ACCESS_KEY
  # (ou depuis ~/.aws/credentials en local)
}

# ────────────────────────────────────────────────
# VPC — Réseau privé virtuel
# ────────────────────────────────────────────────
resource "aws_vpc" "nukunu_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name    = "nukunu-vpc"
    Project = "nukunu-solar"
    Env     = "production"
  }
}

resource "aws_internet_gateway" "nukunu_igw" {
  vpc_id = aws_vpc.nukunu_vpc.id
  tags = { Name = "nukunu-igw" }
}

# ────────────────────────────────────────────────
# Subnet Public
# ────────────────────────────────────────────────
resource "aws_subnet" "nukunu_public" {
  vpc_id                  = aws_vpc.nukunu_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = { Name = "nukunu-public-subnet" }
}

resource "aws_route_table" "nukunu_rt" {
  vpc_id = aws_vpc.nukunu_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.nukunu_igw.id
  }

  tags = { Name = "nukunu-route-table" }
}

resource "aws_route_table_association" "nukunu_rta" {
  subnet_id      = aws_subnet.nukunu_public.id
  route_table_id = aws_route_table.nukunu_rt.id
}

# ────────────────────────────────────────────────
# Security Group — Firewall (BC01-CP3)
# SSH restreint à l'IP admin uniquement
# ────────────────────────────────────────────────
resource "aws_security_group" "nukunu_sg" {
  name        = "nukunu-security-group"
  description = "Regles de securite Nukunu Solar (BC01-CP3)"
  vpc_id      = aws_vpc.nukunu_vpc.id

  # SSH — Accès public pour CI/CD (GitHub Actions)
  ingress {
    description = "SSH public for CI/CD"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP public
  ingress {
    description = "HTTP public traffic"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS public
  ingress {
    description = "HTTPS public traffic"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Application Nukunu (accès direct dev/staging)
  ingress {
    description = "Nukunu App Port"
    from_port   = 3002
    to_port     = 3002
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Grafana (Dashboards)
  ingress {
    description = "Grafana Dashboard public"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Prometheus (admin seulement)
  ingress {
    description = "Prometheus"
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = [var.admin_ip_cidr]
  }

  # Tout le trafic sortant autorisé
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "nukunu-sg"
    Project = "nukunu-solar"
  }
}

# ────────────────────────────────────────────────
# Key Pair SSH
# ────────────────────────────────────────────────
resource "aws_key_pair" "nukunu_keypair" {
  key_name   = var.key_pair_name
  public_key = var.ssh_public_key
}

# ────────────────────────────────────────────────
# AMI Ubuntu 22.04 LTS (x86_64) — data source
# ────────────────────────────────────────────────
data "aws_ami" "ubuntu_22_04" {
  most_recent = true
  owners      = ["099720109477"] # Canonical (Ubuntu officiel)

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

# ────────────────────────────────────────────────
# EC2 t2.micro — Instance principale (FREE TIER)
# 1 vCPU, 1 GB RAM, 750h/mois gratuites (12 mois)
# ────────────────────────────────────────────────
resource "aws_instance" "nukunu_server" {
  ami                    = data.aws_ami.ubuntu_22_04.id
  instance_type          = var.instance_type # t2.micro par défaut
  subnet_id              = aws_subnet.nukunu_public.id
  vpc_security_group_ids = [aws_security_group.nukunu_sg.id]
  key_name               = aws_key_pair.nukunu_keypair.key_name

  # EBS Root Volume — 30GB gratuits dans le Free Tier
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20 # 20GB app + 10GB swap+logs via EBS séparé
    delete_on_termination = true
    encrypted             = true

    tags = { Name = "nukunu-root-ebs" }
  }

  # Cloud-init : configuration swap (critique pour t2.micro 1GB RAM)
  user_data = <<-EOF
    #!/bin/bash
    set -e

    # === Swap 2GB (compense la RAM limitée du t2.micro) ===
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    # Ajout au fstab (idempotent via grep)
    grep -q "/swapfile" /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

    # Réduire l'utilisation du swap (ne l'utiliser qu'en dernier recours)
    sysctl vm.swappiness=10
    grep -q "vm.swappiness" /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf

    # === Mises à jour et dépendances ===
    apt-get update -y
    apt-get install -y curl unattended-upgrades fail2ban

    # === Docker (officiel) ===
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker ubuntu

    echo "✅ Nukunu — instance AWS prête" > /var/log/nukunu-init.log
  EOF

  tags = {
    Name    = "nukunu-solar-server"
    Project = "nukunu-solar"
    FreeTier = "t2.micro"
  }
}

# ────────────────────────────────────────────────
# Elastic IP — IP publique fixe (gratuite si associée)
# ────────────────────────────────────────────────
resource "aws_eip" "nukunu_eip" {
  instance = aws_instance.nukunu_server.id
  domain   = "vpc"

  tags = { Name = "nukunu-eip" }
}
