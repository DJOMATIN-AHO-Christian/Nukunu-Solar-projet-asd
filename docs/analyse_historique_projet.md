# 📊 Analyse Historique et Évolution du Projet : Nukunu Solar

Ce document retrace l'intégralité des actions, décisions techniques et optimisations apportées au projet **Nukunu Solar** depuis sa création jusqu'à sa phase finale de préparation pour la soutenance de la certification ASD.

L'évolution du projet se divise en **4 grandes phases**.

---

## Phase 1 : Fondation et Architecture (Mars 2026)
*L'objectif de cette phase était de poser des bases solides, tant sur le plan du code que de l'infrastructure d'hébergement.*

*   **Initialisation du Dépôt** : Création du projet et structuration initiale en séparant clairement le Frontend (`client/`) et le Backend (`server/`).
*   **Infrastructure as Code (IaC)** : 
    *   Écriture des scripts **Terraform** pour automatiser la création des serveurs dans le Cloud.
    *   Développement des **Playbooks Ansible** pour configurer l'OS des serveurs, installer Docker et sécuriser l'environnement.
*   **Développement Frontend (UI/UX)** : Mise en place d'une interface en Vanilla JS (pour la performance) intégrant un moteur de thèmes dynamique (Clair/Sombre) et un design system propre.
*   **Documentation Initiale** : Rédaction du Cahier des Charges (CDC) et des premières maquettes. Intégration de schémas interactifs `Mermaid` dans le README pour visualiser les flux de données.

## Phase 2 : Développement Métier et Conteneurisation
*Transformation de l'application locale en un système déployable et monitoré.*

*   **Logique Backend** : Développement de l'API Node.js/Express, sécurisation par **JWT** et mise en place de la base de données relationnelle **PostgreSQL 16**.
*   **Dockerisation** : Création des `Dockerfile` et des fichiers `docker-compose.yml` (Local, AWS et Monitoring) pour garantir que l'application tourne de manière identique partout.
*   **CI/CD Pipeline** : Mise en place de **GitHub Actions** (`deploy.yml`) pour automatiser le linting, l'analyse de sécurité (Trivy), les tests unitaires (`node --test`) et le déploiement SSH vers AWS à chaque `git push`.

## Phase 3 : Stabilisation et Débogage de Production (18 Avril 2026)
*Le déploiement sur l'instance AWS `t3.micro` (Free Tier) a révélé des problèmes liés aux contraintes matérielles, nécessitant une ingénierie d'optimisation.*

*   **Traque des "OOM Kills" (Grafana)** : 
    *   *Problème* : Grafana crashait en boucle par manque de RAM.
    *   *Action* : Suppression des limites strictes de ressources dans Docker qui étouffaient le processus Go.
    *   *Action* : Création d'un **Swap de 2 Go** sur le serveur AWS pour encaisser les pics de mémoire au démarrage.
    *   *Action* : Correction d'une boucle infinie causée par un conflit dans les fichiers de provisioning YAML de Grafana.
*   **Sécurité et Droits** : Rétablissement de l'utilisateur standard (UID 472) pour Grafana après avoir corrigé les permissions du volume sur le serveur AWS (abandon de l'utilisateur `root` temporaire).
*   **Réseau et Accès API** : Résolution de l'erreur frontend `"Failed to fetch"` en modifiant le Security Group AWS (Terraform) pour autoriser publiquement l'accès au port 3002.
*   **Base de Données** : Correction du script de migration `migrate-admin.js` et injection du compte Super Administrateur en production.
*   **Hygiène du Code** : Suppression de plus de 2400 lignes de logs inutiles et nettoyage des dossiers redondants (`docker/` vs `infra/docker/`).

## Phase 4 : Préparation Soutenance et Sécurisation Finale (24 Avril 2026)
*Alignement final du projet avec les exigences strictes du jury d'examen (notamment la compétence BC01-CP3 sur la sécurité réseau).*

*   **Fermeture des Ports (Reverse Proxy)** : Le jury pénalisant l'exposition directe du port 3002 sur internet, un conteneur **Nginx** a été configuré. Il écoute de manière sécurisée sur le port 80/443 et transfère le trafic en interne vers l'API. Le port 3002 a été refermé dans Terraform.
*   **Nettoyage Git** : Suppression définitive de la branche `master` en local et sur GitLab/GitHub pour ne conserver que la branche standard `main`, évitant toute ambiguïté pour les correcteurs.
*   **Enrichissement du Dossier de Jury** :
    *   Ajout d'un récit technique complet sur la résolution des "OOM Kills" dans le document d'architecture (`docs/architecture_and_tools.md`), prouvant les capacités de diagnostic.
    *   Extraction et intégration de captures d'écran réelles des tableaux de bord Grafana (`docs/mockups/`) pour prouver le bon fonctionnement de la supervision.
    *   Mise à jour du schéma d'architecture du `README.md` pour refléter la nouvelle topologie réseau (Nginx).

---

> [!NOTE]
> **Conclusion** : Le projet est passé d'un prototype local monolithique à une architecture SaaS distribuée, conteneurisée, sécurisée par un proxy, monitorée en temps réel (Prometheus/Grafana) et déployée via un pipeline d'intégration continue industriel. Le dépôt Git est propre, documenté et prêt à être évalué.
