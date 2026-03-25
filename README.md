# Nukunu Solar — Plateforme SaaS d'Optimisation Énergétique

## Description du Projet
Nukunu Solar est une solution logicielle innovante conçue pour les acteurs de la filière photovoltaïque (Installateurs, Fonds d'investissement, Industriels et Particuliers). La plateforme permet de monitorer en temps réel la production solaire, de gérer la maintenance O&M, d'automatiser la facturation et d'optimiser les flux énergétiques (stockage batterie et pilotage de charge) pour maximiser la rentabilité des installations.

## Stack Technique
- **Backend** : Node.js with Express.js (API REST, JWT Auth)
- **Frontend** : Vanilla HTML5, Modern CSS (Design System sur mesure), Javascript ES6
- **Base de Données** : PostgreSQL 16 (Structure relationnelle normalisée)
- **Infrastructure** : Oracle Cloud Infrastructure (OCI) / Instances Ampere A1 (ARM)
- **Déploiement & Orchestration** : Docker, Docker Compose, K3s (Kubernetes léger)
- **Automatisation** : Terraform (IaC), Ansible (Configuration Management)

## Architecture Résumée
Le projet repose sur une architecture distribuée et conteneurisée. Le backend Express assure la logique métier et l'isolation des données par rôle, tandis que la base de données PostgreSQL garantit l'intégrité des données transactionnelles. L'infrastructure est provisionnée via Terraform sur OCI, configurée par Ansible pour assurer la haute disponibilité, et les services sont orchestrés par K3s pour une scalabilité horizontale facilitée.
