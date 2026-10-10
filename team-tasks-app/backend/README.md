# Backend TypeScript

API Express + Prisma/SQLite, compatible avec le frontend existant. Le backend Laravel voisin reste inchangé.

```bash
copy .env.example .env
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

L’API est servie sur `http://localhost:8000/api`. Les comptes de démonstration utilisent le mot de passe `password`.
