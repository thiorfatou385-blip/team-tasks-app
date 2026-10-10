# Gestion des tâches - React + Laravel

Application de gestion de projets et de tâches d'équipe avec rôles (Manager,
Lead développeur, Développeur) et intégration GitHub (création de branche depuis une tâche).

```
team-tasks-app/
├── backend/    API Laravel (voir backend/README.md)
└── frontend/   Application React + Vite (voir frontend/README.md)
```

## Démarrage rapide

1. **Backend** : suivez `backend/README.md` (composer install, migrate --seed, artisan serve)
2. **Frontend** : suivez `frontend/README.md` (npm install, npm run dev)
3. Connectez-vous avec un des comptes de démonstration listés dans `backend/README.md`

## Règles métier couvertes
- Authentification par rôle : Manager / Lead développeur / Développeur
- Le Manager crée des projets (1 seul Manager + 1 seul Lead dev par projet) et des utilisateurs
- Le Lead développeur crée des tâches prédéfinies et les assigne à un développeur
- Le développeur peut prendre une tâche libre, la marquer en cours puis terminée
- Une tâche non assignée devient prenable par tout développeur 3 jours après sa création
- Un développeur ne peut pas dépasser 3 tâches actives simultanément
- Une tâche assignée non démarrée 1 jour après sa date de démarrage est libérée
  (manuellement par le Lead dev, ou automatiquement via la commande planifiée)
- Création d'une branche GitHub à partir d'une tâche (API GitHub, jeton côté serveur)
