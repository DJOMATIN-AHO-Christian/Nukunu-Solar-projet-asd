# CAHIER DES CHARGES
## Nukunu Solar Intelligence
Plateforme SaaS de gestion & monitoring pour acteurs de l'énergie renouvelable — Afrique

**Candidat** : DJOMATIN AHO Christian  
**Certification** : Administrateur Systèmes DevOps (ASD)  
**Session** : Juillet 2026  
**Titre du projet** : Nukunu Solar Intelligence  
**Contexte réel** : Startup co-fondée en Afrique en 2024 — projet entrepreneurial personnel  
**Date de rédaction** : 25 mars 2026  

---

### 1. Contexte et Besoin Client

#### 1.1 Présentation de la startup Nukunu
**Nukunu** est une startup co-fondée en 2024 en Afrique par DJOMATIN AHO Christian et des associés partageant une vision commune : offrir aux acteurs de l'énergie renouvelable sur le continent des outils de gestion intelligente accessibles et abordables. Le marché de l'énergie solaire en Afrique subsaharienne connaît une croissance soutenue, portée par les besoins d'électrification rurale, l'essor des installations photovoltaïques et l'intérêt croissant des fonds d'investissement ESG pour ce secteur.

Face à l'absence de fonds propres pour financer directement un déploiement commercial à grande échelle, l'équipe fondatrice a adopté une stratégie bootstrapping : développer une plateforme SaaS commercialisable pour générer des revenus récurrents, alimenter la trésorerie de la startup et se constituer un background crédible dans le domaine de l'énergie avant une éventuelle levée de fonds.

#### 1.2 Problème identifié — le vide du marché
Les professionnels de l'énergie renouvelable en Afrique (installateurs, exploitants de parcs solaires, fonds d'investissement verts, industriels en autoconsommation) pilotent aujourd'hui leur activité avec des outils inadaptés : fichiers Excel disparates, logiciels propriétaires coûteux conçus pour les marchés européens, absence d'outils SaaS taillés pour les contraintes locales (connectivité variable, multi-site, multidevise). Aucune solution abordable et spécialisée n'existe à ce jour pour ce segment de marché africain.

#### 1.3 Déclencheur — la stratégie produit de Nukunu
Pour amorcer la trésorerie et se forger une légitimité sectorielle, l'équipe Nukunu a décidé de développer en interne une première version de sa plateforme : **Nukunu Solar Intelligence**. Ce logiciel est conçu pour être vendu en mode SaaS (abonnement mensuel par profil d'utilisateur) à des acteurs du marché de l'énergie renouvelable. Il sert simultanément de démonstrateur technique auprès de futurs partenaires ou investisseurs. Le projet ASD porte sur la conception et le déploiement de l'infrastructure DevOps qui héberge et opère cette plateforme.

#### 1.4 Objectif attendu
Concevoir, déployer et opérer une infrastructure cloud moderne, automatisée et sécurisée, capable d'héberger la plateforme SaaS Nukunu en conditions de production réelles :
- **Isolation stricte des données** par profil client (Installateur, Fonds/Investisseur, Industriel, Particulier).
- **Déploiement entièrement automatisé** via Infrastructure-as-Code, re-exécutable en moins de 10 minutes.
- **Supervision temps réel** permettant de garantir les SLAs engagés auprès des clients abonnés.
- **Architecture évolutive**, prête à accueillir de nouveaux clients sans refonte majeure.
- **Socle technique crédible et documenté**, valorisable lors d'une future levée de fonds ou d'un partenariat industriel.

---

### 2. Périmètre Fonctionnel

#### 2.1 Services à déployer
- **API Backend** — Node.js / Express, logique métier et authentification JWT.
- **Base de données** — PostgreSQL 16, persistance des données de production et des utilisateurs.
- **Frontend** — Single Page Application (SPA) responsive, support thème Sombre / Clair.
- **Reverse Proxy** — Terminaison TLS, routage des requêtes vers les services internes.
- **Orchestration des conteneurs** — K3s (Kubernetes léger) sur instances ARM Ampere A1 OCI.

#### 2.2 Utilisateurs cibles et périmètre d'accès

| Profil | Fonctionnalités accessibles |
| :--- | :--- |
| **Installateur** | Gestion de la maintenance, suivi des tickets d'intervention, état des équipements. |
| **Fonds / Investisseur** | Reporting financier, indicateurs P50 / P90, tableaux de bord ESG. |
| **Industriel** | Suivi de l'autoconsommation, pilotage de charge, optimisation énergétique. |
| **Particulier** | Monitoring journalier de la production, visualisation des économies réalisées. |

---

### 3. Contraintes Techniques

#### 3.1 Infrastructure cible
- **Cloud Provider** : Oracle Cloud Infrastructure (OCI) — instances ARM Ampere A1.
- **Orchestration** : Kubernetes léger K3s, déployé sur les instances OCI.
- **Conteneurisation** : images Docker standardisées, registre privé.
- **Réseau** : Virtual Cloud Network (VCN) OCI, Security Lists restrictives, principe du moindre privilège.

#### 3.2 Contraintes de sécurité
- **Authentification** : accès SSH restreint aux clés publiques uniquement, aucun mot de passe accepté.
- **Tokens** : authentification applicative par JWT (JSON Web Tokens), durée de vie limitée.
- **Secrets** : variables d'environnement via fichiers `.env` exclus du contrôle de version (`.gitignore`). Aucun credential en clair dans le code source ou dans les images Docker.
- **Réseau** : Security Lists OCI configurées au minimum nécessaire, trafic public chiffré TLS.
- **Mises à jour** : validées en environnement de staging avant tout déploiement en production.

#### 3.3 Contraintes d'exploitation
- **Disponibilité** : supervision continue des services via dashboards de monitoring intégrés.
- **Idempotence** : scripts de provisionnement Bash / Terraform re-exécutables sans erreur ni effet de bord.
- **Déploiement** : durée maximale de 10 minutes de la commande de déclenchement à la mise en service.
- **Alertes** : notification en cas d'incident ou de dégradation détectée.

---

### 4. Livrables Attendus

| Livrable | Description | Compétence ASD |
| :--- | :--- | :--- |
| **Scripts de Provisioning** | Scripts `setup-vm.sh` et manifestes IaC Terraform / Ansible pour la création automatisée des serveurs. | CP1 — Automatiser les serveurs |
| **Configuration Sécurité** | Fichiers `.gitignore`, Security Lists OCI, règles de filtrage réseau et gestion des secrets. | CP3 — Sécuriser l'infrastructure |
| **Images & Orchestration** | Dockerfile backend, `docker-compose.yml`, manifestes K3s pour le déploiement des conteneurs. | CP7 — Gérer des containers |
| **Pipeline CI/CD** | Workflows GitHub / GitLab Actions pour les déploiements automatisés, synchronisation des dépôts. | CP8 — Automatiser la MEP |
| **Dashboards Monitoring** | Interfaces de suivi de la production en temps réel, alerting et indicateurs de disponibilité. | CP9 / CP10 — Supervision |

---

### 5. Validation

Ce cahier des charges constitue le document de référence pour l'évaluation du projet **Nukunu Solar Intelligence** dans le cadre de la certification Administrateur Systèmes DevOps (ASD), session **Juillet 2026**. Il délimite le périmètre du projet et servira de base à chaque vérification de conformité lors de l'entretien technique devant le jury.

**Candidat** : DJOMATIN AHO Christian  
**Lieu / Date** : Valenciennes, 25 mars 2026
