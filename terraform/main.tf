terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 5.0.0"
    }
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

# ────────────────────────────────────────────────
# VCN (Virtual Cloud Network) & Sous-réseaux
# ────────────────────────────────────────────────
resource "oci_core_vcn" "nukunu_vcn" {
  compartment_id = var.compartment_id
  cidr_blocks    = ["10.0.0.0/16"]
  display_name   = "nukunu-vcn"
}

resource "oci_core_internet_gateway" "nukunu_ig" {
  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.nukunu_vcn.id
  display_name   = "nukunu-ig"
  enabled        = true
}

resource "oci_core_default_route_table" "nukunu_rt" {
  manage_default_resource_id = oci_core_vcn.nukunu_vcn.default_route_table_id
  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.nukunu_ig.id
  }
}

# ────────────────────────────────────────────────
# Firewall Rules (Sécurité)
# ────────────────────────────────────────────────
resource "oci_core_security_list" "nukunu_sl" {
  compartment_id = var.compartment_id
  vcn_id         = oci_core_vcn.nukunu_vcn.id
  display_name   = "nukunu-security-list"

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  ingress_security_rules {
    # SSH restreint à l'IP du bastion si fournie, sinon ouvert pour le test
    source   = var.bastion_ip != "" ? "${var.bastion_ip}/32" : "0.0.0.0/0"
    protocol = "6" # TCP
    tcp_options { min = 22, max = 22 }
  }
  ingress_security_rules {
    source   = "0.0.0.0/0"
    protocol = "6"
    tcp_options { min = 80, max = 80 }
  }
  ingress_security_rules {
    source   = "0.0.0.0/0"
    protocol = "6"
    tcp_options { min = 443, max = 443 }
  }
  ingress_security_rules {
    # K3s API (optionnel, pour kubectl distant)
    source   = var.bastion_ip != "" ? "${var.bastion_ip}/32" : "0.0.0.0/0"
    protocol = "6"
    tcp_options { min = 6443, max = 6443 }
  }
}

resource "oci_core_subnet" "nukunu_subnet" {
  compartment_id    = var.compartment_id
  vcn_id            = oci_core_vcn.nukunu_vcn.id
  cidr_block        = "10.0.0.0/24"
  security_list_ids = [oci_core_security_list.nukunu_sl.id]
  route_table_id    = oci_core_vcn.nukunu_vcn.default_route_table_id
}

# ────────────────────────────────────────────────
# Instance K3s Master (ARM Ampere A1 Always Free)
# ────────────────────────────────────────────────
data "oci_identity_availability_domain" "ad" {
  compartment_id = var.compartment_id
  ad_number      = 1
}

# Recherche dynamique de la dernière image Ubuntu 22.04 ARM
data "oci_core_images" "ubuntu_arm" {
  compartment_id           = var.compartment_id
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_core_instance" "nukunu_master" {
  availability_domain = data.oci_identity_availability_domain.ad.name
  compartment_id      = var.compartment_id
  display_name        = "nukunu-k3s-master"
  shape               = "VM.Standard.A1.Flex" # Type ARM Gratuit

  shape_config {
    ocpus         = 2  # 2 cœurs gratuits sur les 4
    memory_in_gbs = 12 # 12 Go RAM gratuits sur les 24
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.nukunu_subnet.id
    assign_public_ip = true
  }

  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.ubuntu_arm.images[0].id
    boot_volume_size_in_gbs = 50 # Gratuit (jusqu'à 200Go)
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
  }
}
