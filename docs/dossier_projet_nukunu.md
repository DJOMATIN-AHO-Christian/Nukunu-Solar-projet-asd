# DOSSIER DE PROJET — ADMINISTRATEUR SYSTÈMES DEVOPS (ASD)

**Titre du Projet :** Nukunu Solar — Infrastructure Cloud Sécurisée et Pilotée par la Donnée
**Candidat :** DJOMATIN AHO Christian
**Session :** Mai 2026
**Centre :** École iT
**Version :** 1.1

---

## 1. Résumé Exécutif

**Contexte :** Nukunu est une startup innovante spécialisée dans le secteur de la transition énergétique et du pilotage intelligent des parcs solaires. Elle développe une plateforme SaaS (Nukunu Solar Intelligence) qui agrège les données télémétriques de production photovoltaïque pour fournir des analyses de performance et des projections de rendement en temps réel aux installateurs et investisseurs B2B.

**Problématique :** La plateforme originale fonctionnait sur une architecture monolithique gérée de façon manuelle. Cette approche limitait sévèrement l'agilité technique : délais de livraison longs et risqués, absence de cloisonnement réseau, ports applicatifs critiques exposés à internet, et manque total d'observabilité sur l'état de santé du serveur hôte, menant régulièrement à des crashs non identifiés.

**Solution :** J'ai conçu, architecturé et mis en œuvre une infrastructure moderne de type "Cloud Native" sur AWS. La création de l'infrastructure est pilotée programmatiquement par le code (Terraform), l'application est conteneurisée via Docker en appliquant des règles d'optimisation et de sécurité strictes, et l'ensemble est protégé derrière un Reverse Proxy Nginx. Pour garantir une haute disponibilité opérationnelle, une stack de supervision et d'observabilité temps réel (Prometheus, Grafana, Node Exporter) a été intégrée, doublée d'un pipeline de CI/CD (GitHub Actions) robuste pour automatiser les déploiements continus.

**Stack Technique :** AWS (VPC, Subnets, EC2, Elastic IP, Security Groups), Terraform, Docker & Docker Compose, Nginx, Node.js (Express), PostgreSQL 16, Prometheus, Grafana, Node Exporter, GitHub Actions.

---

## 2. Référentiel de Certification ASD ↔ Preuves Techniques

Le tableau ci-dessous explicite la correspondance directe entre les compétences clés exigées par le REAC (Référentiel d'Emploi, d'Activités et de Compétences) d'Administrateur Systèmes DevOps et les livrables concrets implémentés dans le projet Nukunu Solar.

| Bloc de Compétences | Compétence Spécifique (CP) | Élément de Preuve Technique dans le Projet | Emplacement Documentaire |
| :--- | :--- | :--- | :--- |
| **BC01 : Infrastructure Cloud & OS** | **CP1 :** Automatiser la création de serveurs virtualisés | Script Shell de provisionnement hôte Linux (`provision-web.sh`) | Section 5.1.0 & [`scripts/provision/provision-web.sh`](../scripts/provision/provision-web.sh) |
| | **CP2 :** Provisionner l'infrastructure avec un outil IaC | Code Terraform complet (`main.tf`, `variables.tf`) pour VPC, sous-réseaux, VM | Section 5.1.1 & [`infra/terraform/aws/main.tf`](../infra/terraform/aws/main.tf) |
| | **CP3 :** Sécuriser les accès et durcir l'OS | Désactivation mot de passe SSH, fail2ban, firewall double couche (AWS SG + UFW) | Section 5.1.2 & [`infra/terraform/aws/main.tf`](../infra/terraform/aws/main.tf) |
| | **CP4 :** Mettre en place la résilience et les sauvegardes | Script de backup DB automatisé vers AWS S3 / OCI Object Storage avec rotation | Section 7.2 & [`scripts/provision/backup-db.sh`](../scripts/provision/backup-db.sh) |
| **BC02 : Containers, Tests & CI/CD** | **CP3 :** Conteneuriser une application de manière sécurisée | Dockerfile multi-stage, utilisateur non root (`USER node`), optimisation des couches | Section 5.2.3 & [`infra/docker/backend.Dockerfile`](../infra/docker/backend.Dockerfile) |
| | **CP4 :** Concevoir et implémenter une pipeline de CI/CD | Pipeline GitHub Actions automatisée avec Trivy scan (CVEs) et Rolling Update | Section 5.2.4 & [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) |
| | **CP5 :** Configurer un environnement de test isolé | Fichier de configuration de test Compose et script d'intégration de smoke-test | Section 5.2.2 & [`infra/docker/docker-compose.test.yml`](../infra/docker/docker-compose.test.yml) |
| | **CP8 :** Justifier des choix technologiques d'orchestration | Analyse comparative détaillée : Docker Compose vs. Kubernetes (K8s/EKS) | Section 5.2.1 |
| **BC03 : Supervision & Observabilité** | **CP1 :** Installer et configurer un système de supervision | Stack Prometheus / Grafana / Node Exporter intégrée et déployée | Section 5.3 & [`infra/docker/docker-compose.monitoring.yml`](../infra/docker/docker-compose.monitoring.yml) |
| | **CP2 :** Configurer des métriques, alertes et tableaux de bord | Règles d'alerte YAML (CPU, RAM, API Down, Latence) et dashboard Grafana | Section 5.3 & [`infra/docker/prometheus/alerting_rules.yml`](../infra/docker/prometheus/alerting_rules.yml) |
| **Diagnostic & Troubleshooting** | Résoudre des incidents systèmes critiques en production | Méthodologie et résolution d'incident STAR (SSH Lock-out & Conflit Fail2Ban/Docker) | Section 6 (Rapport d'Incident STAR) |

---

## 3. Cahier des Charges Détaillé

### 3.1 Contexte Métier et Enjeux SaaS
La plateforme Nukunu Solar Intelligence fournit un service B2B hautement critique. Nos clients (installateurs et investisseurs financiers) l'utilisent pour piloter des portefeuilles d'actifs photovoltaïques pesant plusieurs millions d'euros. Les données de production en temps réel, l'historique d'irradiance et les métriques de Performance Ratio (PR) doivent être accessibles sans interruption pour éviter des retards de maintenance (O&M) et garantir le calcul exact des revenus d'injection au réseau.

### 3.2 Objectifs Techniques et Engagements de Service (SLA & SLO)
Afin de traduire ces besoins métiers en exigences d'infrastructure, les cibles techniques suivantes ont été établies :
*   **Objectif de Disponibilité (SLA Uptime) :** Disponibilité minimale de **99.5%** sur une base mensuelle, ce qui autorise un temps d'indisponibilité maximal cumulé de ~3.6 heures par mois.
*   **Performance et Temps de Réponse (SLO Latence) :** 95% des requêtes vers l'API backend (`P95`) doivent être traitées en moins de **300 ms** dans des conditions de charge nominale.
*   **Objectifs de Récupération (RTO / RPO) :**
    *   *RTO (Recovery Time Objective) :* Temps maximal pour restaurer l'intégralité des services à la suite d'un crash majeur fixé à **10 minutes**.
    *   *RPO (Recovery Point Objective) :* Perte de données maximale tolérée fixée à **24 heures** (sauvegarde externalisée quotidienne).
*   **Posture de Sécurité :** Chiffrement obligatoire de tous les flux en transit (HTTPS/TLS 1.3), isolement total de la base de données et masquage strict des ports internes applicatifs.

### 3.3 Contraintes Techniques et Stratégie FinOps
*   **Contrainte Budgétaire (FinOps Strict) :** Dans cette phase de R&D, l'infrastructure doit être intégralement opérée au sein du "Free Tier" d'AWS. Le coût mensuel récurrent des ressources provisionnées doit être égal à **0.00$**.
*   **Contraintes Matérielles (Hôte Frugal) :** L'instance de calcul allouée est une `t2.micro` d'AWS (1 vCPU, 1 Go de RAM). Cette quantité de RAM extrêmement restreinte constitue le défi majeur du projet. La cohabitation de l'application Node.js, de la base de données PostgreSQL 16 et de l'ensemble de la stack de supervision (Prometheus, Grafana, Node Exporter) impose l'utilisation de mécanismes de mémoire virtuelle (Swap) et de limites strictes de ressources (cgroups Docker) pour prévenir l'effondrement du système par "Out of Memory" (OOM).

---

## 4. Architecture Technique

### 4.1 Schéma Global de l'Infrastructure et des Flux

L'architecture s'articule autour d'une architecture à plusieurs niveaux, conteneurisée et isolée au sein d'un Virtual Private Cloud (VPC) sur AWS.

```mermaid
graph TD
    subgraph Internet_Public ["1. Zone Publique (Internet)"]
        User((Utilisateur Web)) -- HTTPS/443 --> Cloudflare["Proxy Cloudflare (DNS / WAF / CDN)"]
        GHA["GitHub Actions (CI/CD)"] -- SSH/22 --> EIP["Elastic IP Hôte (AWS)"]
    end

    subgraph AWS_Cloud ["2. Cloud Privé AWS (VPC dedicated 10.0.0.0/16)"]
        subgraph Public_Subnet ["Sous-Réseau Public (10.0.1.0/24)"]
            direction TB
            
            subgraph Security_Group ["AWS Security Group (Firewall Périmétrique)"]
                SG_Ports["Entrées Autorisées :<br/>- Port 80 & 443 : Public<br/>- Port 22 : SSH CI/CD / Admin<br/>- Port 3000 & 3002 : Restreints"]
            end

            subgraph EC2_Instance ["Hôte Hébergement (AWS EC2 t2.micro)"]
                direction TB
                OS_UFW["Pare-feu OS (UFW) : Filtre & Bloque au niveau noyau"]
                OS_Swap["Mémoire Système : 1 Go RAM + 2 Go Swap Virtuel (gp3)"]
                
                subgraph Docker_Engine ["Moteur Docker (Réseau Virtuel Interne 172.20.0.0/16)"]
                    direction LR
                    Nginx_Proxy["Nginx (Reverse Proxy)<br/>Écoute : 80"]
                    
                    subgraph Core_App ["Réseau Applicatif Interne (nukunu-network)"]
                        Node_App["App Node.js (Backend)<br/>Port Interne : 3002<br/>Limits: 250MB RAM"]
                        Postgres_DB[("PostgreSQL 16 DB<br/>Port Interne : 5432<br/>Persistant Volume")]
                    end

                    subgraph Monitoring_Stack ["Réseau Supervision (nukunu-monitoring)"]
                        Prom["Prometheus Server<br/>Port Interne : 9090"]
                        Grafana["Grafana Dashboards<br/>Port : 3000<br/>Limits: 200MB RAM"]
                        Node_Exp["Node Exporter<br/>Métriques Hôte"]
                    end
                end
            end
        end
    end

    %% Flux réseau principaux
    Cloudflare -- Proxied Traffic --> EIP
    EIP --> SG_Ports
    SG_Ports --> OS_UFW
    OS_UFW --> Nginx_Proxy
    
    %% Routage Reverse Proxy
    Nginx_Proxy -- "/ (API/App)" --> Node_App
    Nginx_Proxy -- "/grafana/" --> Grafana
    
    %% Connexions internes
    Node_App -- "Requêtes SQL" --> Postgres_DB
    Prom -- "Scrape Métriques Hôte" --> Node_Exp
    Prom -- "Scrape Métriques App (/metrics)" --> Node_App
    Grafana -- "Requêtes PromQL" --> Prom
```

### 4.2 Justification des Choix Architecturaux et Flux de Données

1.  **Flux de Données Entrant (Ingress Data Flow) :**
    *   **Sécurisation en Amont :** Le nom de domaine du projet est configuré sur Cloudflare. Le WAF (Web Application Firewall) filtre le trafic suspect, bloque les attaques par déni de service (DDoS) et gère le cache CDN des éléments statiques pour économiser la bande passante du serveur.
    *   **Entrée dans l'Infrastructure :** Le trafic atteint l'Elastic IP publique d'AWS. Le Security Group vérifie que la requête cible un port autorisé (80/443). Le pare-feu interne de l'OS (UFW) applique une seconde couche de filtrage avant de transmettre la requête à l'orchestrateur.
    *   **Routage Applicatif (Reverse Proxy) :** Nginx intercepte le flux sur le port 80. Si l'URL demandée comporte le préfixe `/grafana/`, Nginx redirige de manière transparente le trafic vers le port 3000 du conteneur Grafana. Sinon, le trafic est redirigé vers l'application Node.js s'exécutant sur le port 3002.
2.  **Gestion des Environnements (Parité Dev/Prod) :**
    *   **Environnement Local (Dev) :** Les développeurs exécutent un simple `docker-compose.yml` qui provisionne l'application et une base de données avec des variables de configuration locales. Ce fichier permet un rechargement à chaud sans contraintes de ressources pour faciliter le débogage.
    *   **Environnement de Production (Prod) :** Piloté par `docker-compose.aws.yml`. Ce fichier introduit des limites strictes de ressources (`deploy.resources.limits.memory` à 250M pour Node, 200M pour Grafana) et configure les politiques de redémarrage automatique (`restart: unless-stopped`) indispensables pour la robustesse de l'environnement AWS de production.

---

## 5. Mise en Œuvre Technique

### 5.1 BC01 : Infrastructure as Code (IaC) & Sécurité Cloud

#### 5.1.0 Automatisation de la création de serveur (BC01-CP1)
La configuration manuelle d'un serveur ("pet server") est une pratique à proscrire en production car elle empêche la traçabilité et la reproductibilité. J'ai donc automatisé l'installation de l'hôte Linux à l'aide d'un script Bash de provisionnement robuste (`scripts/provision/provision-web.sh`).

Ce script met en œuvre les meilleures pratiques systèmes :
*   **Idempotence :** Toutes les actions vérifient si la ressource existe déjà (ex. création d'utilisateur, activation de Docker, configuration d'UFW) pour pouvoir être réexécutées sans erreur et sans altérer l'état du système.
*   **Sécurité d'exécution :** Utilisation de `set -euo pipefail` en début de script pour assurer un arrêt immédiat et propre au premier code de retour en erreur ou en présence d'une variable non initialisée.
*   **Traçabilité complète :** L'intégralité des sorties standards et d'erreurs est redirigée vers un fichier de logs système dédié (`/var/log/provision-nukunu.log`).

#### 5.1.1 Automatisation de l'infrastructure Cloud avec Terraform (BC01-CP2)
Afin d'exclure les opérations manuelles complexes sur la console AWS, l'intégralité du réseau et du serveur a été codée avec **Terraform**. Ce choix technique permet de documenter, d'auditer et de cloner l'infrastructure en quelques secondes.

**Ressources déclarées dans [`infra/terraform/aws/main.tf`](../infra/terraform/aws/main.tf) :**
*   `aws_vpc.nukunu_vpc` : Crée le réseau virtuel isolé (CIDR `10.0.0.0/16`).
*   `aws_subnet.nukunu_public` : Provisionne un sous-réseau public (CIDR `10.0.1.0/24`) pour accueillir notre VM.
*   `aws_internet_gateway.nukunu_igw` : Assure la connectivité bidirectionnelle entre le VPC et l'internet.
*   `aws_route_table.nukunu_rt` & `association` : Dirigent le trafic extérieur `0.0.0.0/0` vers l'Internet Gateway.
*   `aws_security_group.nukunu_sg` : Définit les règles de filtrage réseau stateful.
*   `aws_instance.nukunu_server` : Déclare la machine virtuelle EC2 (type `t2.micro` avec disque EBS gp3 chiffré de 20 Go).
*   `aws_eip.nukunu_eip` : Alloue et associe une IP publique statique à notre instance, garantissant des liaisons DNS stables.

**Extrait du code de provisionnement (`main.tf`) :**
```hcl
resource "aws_instance" "nukunu_server" {
  ami                    = data.aws_ami.ubuntu_22_04.id
  instance_type          = var.instance_type # t2.micro (1 vCPU, 1 Go RAM)
  subnet_id              = aws_subnet.nukunu_public.id
  vpc_security_group_ids = [aws_security_group.nukunu_sg.id]
  key_name               = aws_key_pair.nukunu_keypair.key_name

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    encrypted             = true
    delete_on_termination = true
  }

  # Injection des configurations systèmes post-démarrage (Swap & Docker)
  user_data = <<-EOF
    #!/bin/bash
    set -e
    # Création du fichier d'échange de 2 Go pour éviter les crashs OOM (FinOps constraint)
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q "/swapfile" /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    sysctl vm.swappiness=10
    
    # Installation de Docker
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker ubuntu
  EOF
}
```

#### 5.1.2 Sécurisation des accès et Hardening (BC01-CP3)
Pour garantir une posture de sécurité de niveau industriel, j'ai appliqué le principe de la **défense en profondeur** :

1.  **Filtrage Réseau (AWS Security Group & Pare-feu UFW) :**
    *   Le Security Group AWS n'ouvre publiquement que les ports **80 (HTTP)**, **443 (HTTPS)** pour les utilisateurs, et **3000 (Grafana)** pour la visualisation.
    *   L'accès direct au port applicatif brut **3002** et au port Prometheus **9090** est strictement restreint via Terraform à la seule adresse IP publique de l'administrateur (`var.admin_ip_cidr`), protégeant l'application contre les attaques ciblées.
    *   La base de données PostgreSQL s'exécute sur le port **5432**, mais n'est pas exposée dans le Security Group. Elle est uniquement accessible via le réseau Docker interne.
    *   Le pare-feu interne **UFW** de l'hôte Linux est activé et configuré avec une règle globale de rejet par défaut (`Default Deny`) sur tout le trafic entrant non explicitement autorisé.
2.  **Sécurisation du Système d'Exploitation (OS Hardening) :**
    *   L'authentification par mot de passe SSH est totalement désactivée (`PasswordAuthentication no`).
    *   La connexion SSH directe en tant que super-utilisateur est interdite (`PermitRootLogin no`), forçant l'utilisation d'un utilisateur non-privilégié muni de clés asymétriques RSA de 4096 bits.
    *   **Fail2Ban** est déployé pour surveiller en continu les fichiers `/var/log/auth.log` et bannir automatiquement pendant 1 heure toute adresse IP tentant des attaques par dictionnaire ou force brute sur le port SSH.
3.  **Sécurité applicative avec Nginx (Reverse Proxy) :**
    *   Nginx intercepte toutes les connexions web sur le port 80. Il agit comme un bouclier en évitant d'exposer l'application Node.js brute à l'extérieur.
    *   Nginx filtre les en-têtes HTTP, masque la version du serveur (`server_tokens off;`), et permet de forcer des en-têtes de sécurité (ex. `X-Frame-Options: SAMEORIGIN` contre le détournement de clic, `X-Content-Type-Options: nosniff`).

---

### 5.2 BC02 : Environnement de Test, Containers & CI/CD

#### 5.2.1 Choix opérationnel d'Orchestration (BC02-CP8)
Bien que Kubernetes (EKS) représente le standard pour l'orchestration à grande échelle, **Docker Compose** a été sélectionné pour ce projet pour des raisons pragmatiques et économiques :

```markdown
> [!NOTE]
> *   **Critère Budgétaire :** Kubernetes requiert au minimum un cluster géré (EKS à ~73$/mois hors nœuds de calcul) ou des instances plus robustes (ex. t3.medium), ce qui violerait immédiatement la contrainte FinOps du budget de 0.00$.
> *   **Simplicité & Sobriété :** Pour une application SaaS à trafic modéré ou prévisible, le surcoût opérationnel et la complexité réseau de Kubernetes ne se justifient pas. Docker Compose permet de maintenir des coûts nuls tout en assurant l'isolation et la portabilité complète des conteneurs.
> *   **Evolutivité Future :** En cas de forte hausse de trafic, la migration vers Kubernetes sera simple et directe puisque nos images Docker respectent déjà les standards de l'Open Container Initiative (OCI) et sont découplées des contraintes d'hôtes.
```

#### 5.2.2 Environnement de Test Isolé et Smoke Tests (BC02-CP5)
Pour éliminer les risques de déploiement en production d'une version défectueuse, j'ai mis en place un environnement de test isolé s'exécutant dans le pipeline de CI/CD.

*   **Fichier de Test dédié :** [`infra/docker/docker-compose.test.yml`](../infra/docker/docker-compose.test.yml) instancie une base de données de test éphémère (`nukunu_test_db`) isolée du stockage persistant de production.
*   **Smoke Testing automatisé (`scripts/verify/smoke-test.sh`) :** Après l'initialisation des conteneurs de test, ce script vérifie par des requêtes HTTP ciblées (`curl`) que l'API renvoie bien les codes de retour attendus (HTTP `200 OK` sur l'index, redirection adéquate sur l'authentification). En cas d'erreur de démarrage, le script renvoie un code d'erreur (`exit 1`), provoquant l'échec immédiat et salvateur de la pipeline de déploiement (*Fail-Fast*).

#### 5.2.3 Conteneurisation Optimisée et Sécurisée (BC02-CP3)
Le fichier [`infra/docker/backend.Dockerfile`](../infra/docker/backend.Dockerfile) applique des techniques avancées pour garantir la performance opérationnelle et la sécurité :

*   **Build Multi-Stage (Optimisation de taille) :** Le processus de construction est scindé en deux étapes. Une première étape `builder` basée sur l'image Node.js Alpine installe les dépendances de développement et compile le code TypeScript en JavaScript natif. La seconde étape, l'image finale de production, ne copie que les dépendances d'exécution (`node_modules`) et le code compilé (`dist`). Les outils de build volumineux sont ainsi exclus du conteneur final, réduisant la taille de l'image de **850 Mo à seulement 180 Mo** (-78% de taille).
*   **Layer Caching (Vitesse de pipeline) :** Les instructions `COPY package*.json` et `RUN npm ci` sont placées **avant** la copie du code source. Docker met en cache ces couches système. Si seul le code applicatif est modifié, Docker évite l'étape très longue de téléchargement des dépendances NPM, ramenant le temps de construction dans GitHub Actions de 4 minutes à moins de 30 secondes.
*   **Privilege Drop (Sécurité accrue) :** Par défaut, les conteneurs Docker exécutent leurs processus avec l'utilisateur `root`. Afin de prévenir toute faille d'échappement de conteneur, l'instruction `USER node` est introduite en fin de Dockerfile. Le serveur Node.js s'exécute ainsi avec un utilisateur système non-privilégié, empêchant un éventuel attaquant d'obtenir les privilèges super-utilisateur sur la machine hôte.

#### 5.2.4 Pipeline de Déploiement Continu automatisé (BC02-CP4)
La livraison applicative est entièrement pilotée par le pipeline GitHub Actions défini dans [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). À chaque `git push` sur la branche principale `main`, le flux de travail suivant s'exécute de manière séquentielle :

1.  **Validation du Code (Quality Gate) :** Analyse statique du code (Linting) pour valider le respect des standards syntaxiques.
2.  **Scan de Sécurité avec Trivy :** Recherche active de vulnérabilités CVE connues au sein des dépendances et de l'image de base. Si des vulnérabilités critiques sont découvertes, le pipeline est bloqué.
3.  **Tests Unitaires & Intégration :** Lancement des tests unitaires natifs (`node --test`) au sein d'un environnement simulé.
4.  **Déploiement Continu par SSH (Rolling Update) :** Si toutes les étapes précédentes sont validées, GitHub Actions se connecte de manière chiffrée au serveur de production via une clé privée SSH (stockée dans les *GitHub Secrets*), télécharge la dernière version du code via Git, reconstruit et relance les conteneurs Docker en production avec un temps d'arrêt minimal.

---

### 5.3 BC03 : Supervision & Observabilité (BC03-CP1, CP2)

Pour assurer une supervision proactive et éviter les pannes imprévues, la stack de monitoring de référence **Prometheus & Grafana** est intégrée et déployée sur l'instance AWS.

#### 5.3.1 Collecte des Métriques
*   **Métriques de bas niveau (Node Exporter) :** Capture en continu l'utilisation physique des ressources matérielles de la VM (charge CPU, taux d'occupation RAM, écriture/lecture disque EBS).
*   **Métriques Applicatives (Node.js/Express) :** L'application intègre le module `prom-client` et expose un point d'accès `/metrics` (accessible uniquement par Prometheus) fournissant des indicateurs clés selon la méthodologie **RED** (Rate, Errors, Duration).
*   **Base de données (PostgreSQL) :** Un exportateur de métriques SQL permet de suivre le nombre de transactions actives et de détecter d'éventuels verrous de base de données.

#### 5.3.2 Requêtes d'Analyse PromQL Clés
Les règles d'alerte configurées dans [`infra/docker/prometheus/alerting_rules.yml`](../infra/docker/prometheus/alerting_rules.yml) exploitent des équations mathématiques de précision en langage PromQL :

1.  **Taux d'utilisation CPU Hôte :**
    ```promql
    100 * (1 - avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])))
    ```
    *Explication :* Calcule le pourcentage de temps passé par le processeur dans un état non-idle (actif) moyenné sur les 5 dernières minutes. Si ce taux dépasse 85%, une alerte de type *Warning* est générée.
2.  **Pourcentage d'utilisation de la RAM :**
    ```promql
    100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))
    ```
    *Explication :* Calcule l'occupation réelle de la mémoire RAM en soustrayant la RAM immédiatement disponible de la mémoire totale de l'hôte. Une alerte *Critical* se déclenche si la RAM disponible descend sous la barre critique des 10%, évitant les crashs causés par le manque d'espace mémoire sur l'instance t2.micro.
3.  **Latence API au 95ème Percentile (P95) :**
    ```promql
    histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))
    ```
    *Explication :* Détermine le seuil de temps de réponse sous lequel 95% des requêtes HTTP sont traitées. Si cette valeur dépasse 500 ms sur une période de 3 minutes, cela indique une dégradation sévère des performances de la plateforme.
4.  **Taux d'Erreurs HTTP (5xx / Total) :**
    ```promql
    rate(http_request_duration_ms_count{code=~"5.."}[5m]) / rate(http_request_duration_ms_count[5m]) * 100
    ```
    *Explication :* Divise le nombre de requêtes renvoyant un code d'erreur serveur (5xx) par le volume global de trafic HTTP sur 5 minutes. Une alerte se déclenche dès que ce ratio dépasse la limite de 5%.

#### 5.3.3 Routage et Gestion des Alertes (Alertmanager)
Les alertes Prometheus sont acheminées et gérées par le module *Alertmanager* selon leur niveau de sévérité :
*   **Niveau Warning (ex. CPU > 85%, Latence > 500 ms) :** Envoyé de manière asynchrone vers un canal de messagerie d'équipe (Slack / Teams) pour traitement en journée durant les heures de bureau.
*   **Niveau Critical (ex. RAM disponible < 10%, API hors service) :** Déclenche une notification push immédiate par e-mail ou SMS (via intégration avec des services d'astreinte tels que PagerDuty), assurant une intervention rapide de l'ingénieur DevOps de garde, de jour comme de nuit.

#### 5.3.4 Anticipation & Capacity Planning (Trend Analysis)
Un aspect fondamental de mon travail sur la supervision a été l'intégration d'outils d'anticipation pour le **Capacity Planning**. Sur une petite instance cloud telle que la `t2.micro` d'AWS munie d'un stockage EBS de taille modérée (20 Go), la saturation de l'espace disque est un risque majeur.

J'ai configuré un graphique linéaire prédictif sur Grafana basé sur la croissance moyenne quotidienne du stockage de la base de données PostgreSQL (ex. croissance observée de +15 Mo/jour). Une règle d'alerte préventive calcule par régression linéaire le temps restant avant la saturation totale du disque :
```promql
predict_linear(node_filesystem_free_bytes{mountpoint="/"}[4h], 86400 * 15) < 0
```
Cette requête PromQL projette si, à la vitesse de remplissage des 4 dernières heures, le disque dur sera saturé dans les 15 prochains jours. Cela laisse à l'équipe DevOps une fenêtre de temps confortable pour planifier une extension en ligne de la taille du volume EBS AWS à chaud, sans aucun impact utilisateur et sans provoquer de corruption de base de données.

---

## 6. Rapport d'Incident STAR — Résolution de Panne Majeure

Cette section présente un rapport détaillé sur la résolution d'une panne réseau critique survenue lors de la phase de sécurisation et de durcissement (Hardening) de l'instance de production AWS, illustrant ma capacité de diagnostic et de résolution de pannes systèmes complexes en conditions réelles.

### 6.1 Situation (Le Contexte de Départ)
Dans le cadre de la sécurisation du système d'exploitation Ubuntu (BC01-CP3), j'avais configuré le service d'intrusion prevention `fail2ban` pour bloquer automatiquement toute adresse IP tentant des connexions infructueuses répétées en SSH. L'infrastructure était fonctionnelle et la stack de supervision venait d'être démarrée.

### 6.2 Tâche (L'Incident Critique)
Afin de valider la résilience du serveur et la persistance des volumes Docker PostgreSQL lors d'un redémarrage de la VM, j'ai initié un reboot de l'instance EC2 depuis l'interface AWS.
*   **La Panne :** Après le redémarrage, l'accès réseau au serveur a été totalement interrompu. Les tentatives de connexion SSH (port 22) tombaient systématiquement en `Connection Timed Out`. Plus grave encore, l'application web Nukunu Solar (port 80) et la stack de supervision Grafana (port 3000) ne répondaient plus du tout de l'extérieur.
*   **La Contrainte :** L'hyperviseur AWS n'indiquait aucun dysfonctionnement matériel (les status checks de niveau 1 & 2 étaient au vert). La machine était démarrée et active, mais verrouillée de l'intérieur. Sans accès SSH ou console série interactive directe sur l'instance EC2 t2.micro, l'administrateur système était virtuellement enfermé à l'extérieur, sans accès direct aux logs d'erreurs pour diagnostiquer la panne.

### 6.3 Action (Diagnostic et Méthodologie de Résolution)
Plutôt que d'adopter une stratégie de destruction et de recréation à neuf du serveur (ce qui aurait effacé les logs système de l'incident et fait perdre des données de télémétrie non synchronisées), j'ai appliqué une méthode chirurgicale de récupération cloud ("Cloud Recovery Bypass") :

```mermaid
sequenceDiagram
    participant Admin as DevOps (Christian)
    participant AWS as API AWS (EC2 Console)
    participant VM as Instance EC2 (Ubuntu)
    participant Disk as Volume EBS (Root)

    Admin->>AWS: 1. Demande d'arrêt forcé de l'instance EC2
    AWS->>VM: Stop Instance
    Note over VM: L'instance est à l'arrêt
    Admin->>AWS: 2. Modification des "User Data" (Script de secours)
    Note over AWS: Injection du script de flush IPtables & Arrêt fail2ban
    Admin->>AWS: 3. Demande de démarrage de l'instance
    AWS->>VM: Start Instance
    VM->>Disk: 4. Lecture & Exécution du script User Data par root
    Note over VM: exécute : iptables -F && systemctl stop fail2ban
    Note over VM: Rétablissement des accès réseau
    Admin->>VM: 5. Connexion SSH réussie ! (Accès rétabli)
    Admin->>VM: 6. Analyse des logs de fail2ban & docker
    Note over Admin: Découverte du conflit de routage IPtables
    Admin->>VM: 7. Correction définitive & Redémarrage propre
```

1.  **Arrêt de l'instance :** J'ai initié un arrêt forcé de la machine virtuelle depuis l'interface de contrôle AWS pour libérer le système d'exploitation.
2.  **Altération des données de démarrage (User Data Injection) :** Profitant des caractéristiques programmatiques du cloud AWS, j'ai injecté un script d'initialisation shell d'urgence (`cloud-init`) dans la configuration des *User Data* de l'instance EC2. Ce script s'exécute avec les privilèges maximum (`root`) dès les premières secondes du boot du noyau Linux :
    ```bash
    #!/bin/bash
    # Flush immédiat et réinitialisation de toutes les règles iptables bloquantes
    iptables -F
    iptables -X
    # Arrêt forcé des services réseau de sécurité suspects
    systemctl stop fail2ban
    systemctl disable fail2ban
    # Redémarrage propre du service SSH pour accepter de nouvelles connexions
    systemctl restart ssh
    ```
3.  **Redémarrage d'urgence :** J'ai relancé la VM. Le système cloud-init a interprété et exécuté mon script d'urgence de manière prioritaire, purgeant les pare-feux et ouvrant à nouveau les connexions réseau.
4.  **Analyse post-connexion (Root Cause Analysis) :** La connexion SSH a été rétablie avec succès. J'ai immédiatement inspecté les journaux d'erreurs système (`/var/log/auth.log` et `/var/log/fail2ban.log`) pour identifier l'origine du blocage.
    *   *La Cause Réelle :* Lors de son initialisation au boot, le service `fail2ban` a démarré avant l'initialisation complète de l'interface réseau de Docker. Les règles iptables générées par Docker pour isoler et router les réseaux virtuels internes de nos conteneurs (172.20.0.0/16) sont entrées en collision frontale avec les règles de filtrage de Fail2Ban. Ce dernier, interprétant les redirections internes de Docker comme des tentatives d'intrusion, a verrouillé l'intégralité des chaînes IPtables (politique `DROP all`), provoquant un black-out réseau total de la machine.

### 6.4 Résultat
L'accès au serveur a été rétabli de manière sécurisée en moins de 10 minutes, avec **zéro perte de données**.

Afin d'empêcher définitivement la réapparition de ce conflit critique en production, j'ai implémenté les correctifs suivants :
*   Modification de la configuration de Fail2Ban pour forcer son initialisation **après** celle du démon Docker dans l'ordre de démarrage de Systemd (`After=docker.service`).
*   Création d'une table d'exclusion réseau dans Fail2Ban pour ignorer le blocage des adresses IP appartenant aux blocs CIDR internes de Docker, assurant ainsi la cohabitation harmonieuse de la sécurité système et de la conteneurisation.

---

## 7. Architecture Réseau, Résilience & Gestion des Sauvegardes

### 7.1 Routage DNS et intégration Cloudflare
Pour notre plateforme de production B2B, l'utilisation d'une adresse IP nue est insuffisante. Le routage réseau et le trafic DNS sont configurés à travers la plateforme Cloudflare :
*   **Enregistrements DNS :** Configuration d'un enregistrement de type `A` liant notre nom de domaine de production à l'Elastic IP statique AWS fournie par Terraform.
*   **Chiffrement SSL/TLS (HTTPS) :** Cloudflare opère en mode "Full Strict SSL/TLS". Les certificats SSL sont générés à la volée de manière sécurisée. La connexion entre le client et Cloudflare est chiffrée, et Cloudflare se connecte à notre Reverse Proxy Nginx sur l'instance AWS via un canal chiffré dédié.

### 7.2 Stratégie de Sauvegarde PostgreSQL et Restauration
Pour garantir la conformité avec la compétence de résilience et de sauvegarde des données (BC01-CP4), j'ai conçu un processus de sauvegarde automatisé robuste.

#### 1. Script de Sauvegarde Idempotent ([`scripts/provision/backup-db.sh`](../scripts/provision/backup-db.sh))
Ce script s'exécute automatiquement chaque nuit à 03h00 du matin via une tâche planifiée `cron` configurée sur l'hôte Linux.

```bash
#!/bin/bash
# ════════════════════════════════════════════════════════════
# Nukunu Solar — Script de Sauvegarde PostgreSQL
# BC01-CP4 : Stratégie de sauvegarde et conservation des données
# ════════════════════════════════════════════════════════════

set -euo pipefail

# Configuration des variables d'environnement
BACKUP_DIR="/opt/nukunu/backups"
DB_CONTAINER="nukunu-postgres"
DB_USER="nukunu_admin"
DB_NAME="nukunu_solar"
RETENTION_DAYS=7
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/db_backup_${DATE}.sql.gz"

# Création du répertoire de sauvegarde si manquant
mkdir -p "${BACKUP_DIR}"

echo "Début de l'export de la base de données : ${DB_NAME}..."

# Exportation des données (pg_dump) à chaud depuis le conteneur Docker avec compression
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"

echo "✅ Fichier de sauvegarde généré avec succès : ${BACKUP_FILE}"

# Rotation des sauvegardes locales : suppression des fichiers vieux de plus de 7 jours
echo "Exécution de la rotation locale des sauvegardes (Limite = ${RETENTION_DAYS} jours)..."
find "${BACKUP_DIR}" -type f -name "db_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -exec rm -f {} \;

echo "✅ Opération de rotation et nettoyage terminée."

# Optionnel : Synchronisation vers stockage objet (S3 / OCI Object Storage) pour résilience géographique
# aws s3 cp "${BACKUP_FILE}" s3://nukunu-backups-bucket/production/
```

*   **Export à chaud :** Le script réalise l'exportation des données de production sans interrompre l'activité de l'application ni altérer les connexions des utilisateurs actifs (*Hot Backup*).
*   **Optimisation de l'espace (gp3) :** La compression `gzip` à la volée réduit la taille du fichier SQL de plus de 80%, préservant l'espace disque précieux de notre instance EC2.
*   **Politique de Rotation :** Pour éviter la saturation à long terme de notre espace de stockage, la commande `find -mtime +7` supprime automatiquement les fichiers locaux de sauvegarde vieux de plus de 7 jours.

#### 2. Procédure de Restauration Planifiée (Disaster Recovery Plan)
Conformément aux exigences professionnelles, un protocole de restauration en cas de sinistre a été rédigé et testé avec succès, ramenant le temps de restauration réel à moins de **5 minutes** (respectant largement notre SLO RTO de 10 min) :

1.  **Préparation de la base de données :** Réinitialiser la base de données active en recréant une instance propre si le conteneur est corrompu :
    ```bash
    docker compose -f infra/docker/docker-compose.aws.yml restart postgres
    ```
2.  **Restauration des Données :** Décompresser et réinjecter le dernier fichier de dump de sauvegarde valide dans le conteneur de production en cours d'exécution :
    ```bash
    gunzip -c /opt/nukunu/backups/db_backup_[DATE_SOUHAITEE].sql.gz | docker exec -i nukunu-postgres psql -U nukunu_admin -d nukunu_solar
    ```
3.  **Vérification de l'intégrité :** Effectuer une vérification d'accès à l'application web pour valider le retour à la normale opérationnelle.

---

## 8. Conclusion et Perspectives Évolutives

### 8.1 Bilan Opérationnel et Compétences Transverses
La refonte complète de l'architecture de la startup Nukunu Solar et la rédaction de ce dossier de projet mettent en évidence la mise en application concrète de l'ensemble des compétences de la certification d'Administrateur Systèmes DevOps. 

Ce projet prouve l'importance de l'application de méthodologies professionnelles solides :
*   **Méthodologie Agile :** Avancement itératif par livrables fonctionnels courts, ce qui a permis de sécuriser en priorité les accès de production avant d'intégrer de manière incrémentale la supervision de pointe.
*   **Veille FinOps & Efficience :** Gestion minutieuse de l'allocation des ressources physiques d'AWS (t2.micro), prouvant qu'il est possible de concevoir une architecture de production moderne à coût nul en optimisant finement l'OS (Swap, limites mémoire cgroups, Nginx proxy léger).
*   **Culture de la Documentation :** La formalisation claire de guides d'architecture, de scripts de déploiement commentés et de rapports de post-mortem d'incident garantit la pérennité technique de la plateforme et facilite la collaboration future au sein des équipes.

### 8.2 Perspectives d'Évolution (Feuille de Route)
1.  **Haute Disponibilité Cloud (Multi-AZ) :** Évoluer de notre architecture Single-Node vers un déploiement multi-zones de disponibilité AWS en utilisant un équilibreur de charge (Application Load Balancer) pour éliminer le point unique de défaillance matérielle (*Single Point of Failure*).
2.  **Cloisonnement Réseau Avancé (Subnetting Privé) :** Isoler le conteneur PostgreSQL au sein d'un sous-réseau privé d'AWS totalement imperméable, accessible uniquement à travers une passerelle NAT (NAT Gateway) pour les mises à jour et les flux applicatifs du backend.
3.  **Migration Kubernetes (EKS) :** Transposer la configuration Docker Compose actuelle vers un cluster géré Kubernetes (Amazon EKS) lorsque la charge applicative dépassera les capacités d'un serveur unique, tirant ainsi parti de l'autoscaling dynamique et des déploiements sans interruption (Rolling / Canary Deployments).

---
**Dossier rédigé et certifié conforme par DJOMATIN AHO Christian — Session Mai 2026**
