# Architecture Détailée — Nukunu Solar

## Vue d'Ensemble
L'architecture de Nukunu Solar est conçue pour être résiliente, scalable et sécurisée, répondant aux exigences d'une application de monitoring critique en milieu distribué.

### 1. Couche Présentation (Frontend)
- **Composants** : Single Page Application (SPA).
- **Communication** : Requêtes asynchrones Fetch vers l'API Backend.
- **Sécurité** : Stockage sécurisé des tokens JWT, protection XSS via l'utilisation stricte de templates.

### 2. Couche Logique (Backend API)
- **Moteur** : Node.js (Runtime asynchrone non-bloquant).
- **Services** : 
    - Auth Service (Bcrypt, JWT).
    - Data Service (Hydratation des données via APIs externes météo/marché).
    - Role Engine (Data partitioning strict par `user_id` et `role`).

### 3. Couche Persistance (Database)
- **Moteur** : PostgreSQL 16.
- **Isolation** : Séparation logique des données clients au sein d'un schéma unique mais filtré via des index sur `user_id`.
- **Volumes** : Utilisation de volumes persistants Docker/K8s pour garantir la durabilité des données.

### 4. Infrastructure & Orchestration
- **Orchestration** : K3s gère le cycle de vie des conteneurs, assurant le redémarrage automatique en cas de panne (self-healing).
- **Provisionnement** : Terraform définit le réseau cloud (VCN, Sous-réseaux, Security Lists) et les instances compute.
- **Configuration** : Ansible déploie les dépendances système et injecte les secrets de production de manière idempotente.

## Flux de Données
1. L'utilisateur s'authentifie via le frontend.
2. Le backend valide le JWT et récupère les données filtrées dans PostgreSQL.
3. En parallèle, des workers périodiques synchronisent les données live (ensoleillement, prix spot EPEX) pour enrichir le tableau de bord.
4. Toutes les actions critiques sont loggées pour assurer l'observabilité du système.
