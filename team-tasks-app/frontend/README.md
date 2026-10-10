# Frontend - Gestion des tâches (React + Vite)

## Installation

```bash
npm install
cp .env.example .env   # ajustez VITE_API_URL si besoin
npm run dev
```

L'app démarre sur http://localhost:5173 et appelle l'API sur http://localhost:8000/api
(configurable via `VITE_API_URL`).

## Contenu
- `src/context/AuthContext.jsx` : connexion/déconnexion, jeton Sanctum en localStorage
- `src/pages/Login.jsx` : formulaire de connexion
- `src/pages/Projects.jsx` : liste des projets + création (Manager)
- `src/pages/ProjectDetail.jsx` : tâches d'un projet + création (Lead développeur)
- `src/components/TaskCard.jsx` : toutes les actions sur une tâche (prendre, démarrer,
  terminer, assigner, libérer, créer une branche GitHub) selon le rôle connecté
- `src/pages/Users.jsx` : gestion des utilisateurs (Manager)
