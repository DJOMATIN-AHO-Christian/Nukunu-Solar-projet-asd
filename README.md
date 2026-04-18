# 🏗️ Nukunu Solar — Plateforme SaaS d'Optimisation Énergétique

## 🌟 Présentation du Projet
Nukunu Solar est une solution logicielle innovante conçue pour les acteurs de la filière photovoltaïque (**Installateurs, Fonds d'investissement, Industriels et Particuliers**). 

La plateforme centralise le monitoring en temps réel, la maintenance O&M, l'automatisation de la facturation et l'optimisation des flux énergétiques pour maximiser la rentabilité des actifs solaires.

---

## 🏗️ Architecture et Système

Le système est désormais **stabilisé en production sur AWS** avec une stack de monitoring complète.

- **Frontend** : Interface SPA ultra-rapide en Vanilla JS / CSS Moderne.
- **Backend API** : Serveur Node.js (Express v5) avec authentification JWT sécurisée.
- **Base de Données** : PostgreSQL 16 (Relational Source of Truth).
- **Monitoring (Nouveau)** : Stack Grafana, Prometheus et Node Exporter pour une visibilité totale sur l'infrastructure et l'application.
- **Infrastructure** : 
    - **Host** : AWS EC2 `t3.micro` (Région : Irlande `eu-west-1`).
    - **Sécurité** : Firewall configuré (Ports 22, 3000, 3002 ouverts).
    - **Orchestration** : Docker & Docker Compose pour une isolation totale.

### 📄 Documentation Technique
Pour plus de détails, consultez :
*   [**Architecture & Outils**](docs/architecture_and_tools.md) : Plan détaillé de la stack et rôle de chaque fichier.
*   [**Guide de Déploiement**](docs/aws-deployment.md) : Manuel Terraform et Ansible.

---

## 📊 Supervision et Monitoring (Production)

L'infrastructure AWS intègre une surveillance de niveau entreprise :

1.  **Grafana** : Interface de visualisation des métriques.
    - URL : `http://34.243.24.254:3000`
    - Login par défaut : `admin` / `admin`
2.  **Prometheus** : Collecte des données de santé toutes les 15 secondes.
3.  **Node Exporter** : Monitoring matériel (CPU, RAM, Disque) du serveur EC2.

---

## 🚀 Installation et Déploiement

### Déploiement Cloud (AWS)
Le déploiement est **100% automatisé** via GitHub Actions à chaque `push` sur la branche `main`.

**Flux CI/CD :**
1. **Linting** : Validation ESLint.
2. **Scan Sécurité** : Analyse d'images via Trivy.
3. **Tests E2E** : Validation fonctionnelle via Playwright.
4. **Deploy** : Mise à jour automatique des conteneurs sur AWS EC2 via SSH.

### Exécution Locale (Docker Compose)
```bash
# Lancement de l'application et du monitoring localement
docker-compose -f infra/docker/docker-compose.yml up -d
```

---

## 🔐 Accès de Test (Environnement Stable)

Pour tester l'interface complète (Administration incluse) :
- **URL App** : [http://34.243.24.254:3002](http://34.243.24.254:3002)
- **Super Admin** : `superadmin@nukunu.com`
- **Password** : `superpassword123`

---

## 🧹 Maintenance et Qualité
Le projet a été nettoyé de tous les fichiers redondants et logs obsolètes pour garantir une légèreté maximale du dépôt Git. La structure suit désormais des principes DevOps stricts.

---

*Projet développé par [DJOMATIN AHO Christian](https://github.com/DJOMATIN-AHO-Christian) dans le cadre de la certification ASD.*
om/DJOMATIN-AHO-Christian) dans le cadre de la certification ASD.*
