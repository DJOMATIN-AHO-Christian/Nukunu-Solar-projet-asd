# ASD — Cahier des Charges (CDC)
## Projet : Nukunu Solar Intelligence

**Candidat :** DJOMATIN AHO Christian  
**Session :** ASD — Mars 2026

---

### 1. Contexte et Besoin Client

#### Situation Initiale
L'entreprise **Nukunu Solar** gérait initialement son parc photovoltaïque de manière artisanale. Les données de production étaient exploitées via des fichiers Excel disparates, et l'interface de monitoring n'offrait aucune distinction entre les différents types d'utilisateurs (particuliers vs investisseurs). L'infrastructure était hébergée sur un serveur unique, rendant toute mise à jour risquée et coûteuse en temps.

#### Problème / Déclencheur
La croissance rapide du nombre d'installations (passant de quelques unités à plusieurs centaines de MWc) a rendu la gestion manuelle impossible. Des problèmes de confidentialité sont apparus, et la DSI a exigé une plateforme capable d'isoler strictement les données selon le rôle de l'utilisateur, tout en garantissant une haute disponibilité et des déploiements automatisés.

#### Objectif Attendu
Mettre en place une architecture logicielle et d'infrastructure moderne, distribuée et sécurisée. La solution doit permettre :
- Une **isolation totale des données** par rôle (Installateur, Fonds, Industriel, Particulier).
- Un **déploiement automatisé** (Infrastructure-as-Code) en moins de 10 minutes.
- Une **supervision temps réel** de la production et des indicateurs ESG.

---

### 2. Périmètre Fonctionnel

- **Services à déployer** :
    - API Backend (Node.js/Express) pour la logique métier et l'authentification.
    - Serveur de base de données (PostgreSQL 16) pour la persistance.
    - Interface Frontend (SPA) responsive avec support du mode Sombre/Clair.
- **Utilisateurs cibles** :
    - **Installateurs** : Maintenance et tickets.
    - **Fonds / Investisseurs** : Reporting financier et P50/P90.
    - **Industriels** : Autoconsommation et pilotage de charge.
    - **Particuliers** : Monitoring journalier et économies.

---

### 3. Contraintes Techniques

#### Infrastructure Cible
- **Cloud Provider** : Oracle Cloud Infrastructure (OCI).
- **Orchestration** : Kubernetes léger (K3s) sur instances ARM Ampere A1.
- **Conteneurisation** : Images Docker standardisées.

#### Sécurité
- **Authentification** : Gestion par tokens JWT (JSON Web Tokens).
- **Accès** : SSH restreint aux clés publiques, Security Lists restrictives sur le VCN.
- **Secrets** : Utilisation de variables d'environnement (`.env`) exclues du contrôle de version.

#### Exploitation
- **Disponibilité** : Monitoring des services via dashboards intégrés.
- **Idempotence** : Provisionnement via scripts Bash/Terraform re-exécutables sans erreur.

---

### 4. Livrables Attendus

| Livrable | Description | Compétence ASD |
| :--- | :--- | :--- |
| **Scripts de Provisioning** | Scripts `setup-vm.sh` et manifestes IaC | CP1 - Automatiser les serveurs |
| **Configuration Sécurité** | `.gitignore`, Security Lists OCI | CP3 - Sécuriser l'infra |
| **Images & Orchestration** | `backend.Dockerfile` et `docker-compose.yml` | CP7 - Gérer des containers |
| **Pipeline & Pushes** | Dépôts GitHub/GitLab synchronisés | CP8 - Automatiser la MEP |
| **Dashboards Monitoring** | Interfaces de suivi production temps réel | CP9/10 - Supervision |

---

### 5. Signature et Validation

Ce cahier des charges servira de référence pour l'évaluation finale du projet Nukunu Solar dans le cadre de la certification ASD.
