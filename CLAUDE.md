# CLAUDE.md — contexte du projet Combat Prep

## Utilisateur
Dylan : débutant en musculation, objectif prioritaire **prise de masse et force**.
- Kick-boxing : 1 fois par semaine, en soirée, jour variable. Sparring léger à moyen.
- AMHE : dimanche 13 h – 17 h. Sparring léger à moyen.
- 3 séances de préparation physique par semaine, dont environ 2 en salle.
- Matériel à domicile : élastiques, parallettes, barre de traction, anneaux, sac à dos lesté (bouteilles d'eau).
- Pas de blessure déclarée.
- Repère de charge : curl biceps 4 × 15 à 6 kg. Bloqué à 8 kg auparavant.

Langue de l'interface et des échanges : **français**.

## Méthode de travail (exigée par l'utilisateur)
- Travailler par étapes. À chaque étape, indiquer :
  - ce qui est terminé ;
  - les fichiers modifiés ;
  - les commandes ;
  - les tests effectués ;
  - les limites ;
  - la suite.
- Ne jamais déclarer une fonctionnalité terminée sans l'avoir implémentée **et testée**.
- Ne jamais supprimer de données utilisateur silencieusement. Ne pas afficher de fausses données.
- Les séances générées sont des propositions, toujours modifiables.

## État
- Étapes 1 à 4 terminées (voir README.md).
  - Étape 4 : page Progrès (graphiques, historique, récupération), point de récupération quotidien, séances manquées, mobilité 5 et 15 min.
  - Logique dans `src/domain/stats.ts`, `recovery.ts`, `reschedule.ts` (tests : `step4.test.ts`).
  - Dexie v2 : table `checkins` (clé = date). Sauvegarde en v2 ; les fichiers v1 restent importables.
- Prochaine étape : **étape 5** : tests, corrections, documentation.
- Synchronisation iPhone ↔ PC envisagée plus tard avec Supabase. Pour l'instant : export/import JSON.

## Règles de planification (src/domain/planner.ts)
- Jamais de séance A ou C (jambes lourdes) la veille d'un combat, ni le jour même.
- Au moins 48 h entre deux séances A et C.
- Rien le dimanche (AMHE).
- Si la semaine est trop chargée : retirer une séance plutôt qu'entasser.
- Ordre de priorité pour la salle : A, puis C, puis B.

## Séances manquées (src/domain/reschedule.ts)
- Rattrapage uniquement dans la même semaine, sur un jour à venir. Mêmes règles strictes que le planificateur.
- Sinon : remplacer une séance moins prioritaire (A, puis C, puis B), ou ne pas rattraper (statut « annulée », jamais supprimée).

## Progression (src/domain/progression.ts)
Double progression avec RIR. Un seul paramètre augmente à la fois.

## Technique
- Stack : React + TypeScript + Vite, Dexie (IndexedDB), vite-plugin-pwa, react-router (HashRouter).
- Organisation : `src/domain` (logique pure testée), `src/db` (stockage, sauvegarde), `src/pages`, `src/ui`.
- Règle de modèle : une séance type est un modèle (`TEMPLATES`) ; une `PlannedSession` est une occurrence datée.
- `ensureWeek` crée les occurrences récurrentes à la première ouverture d'une semaine (pas pour les semaines passées).
- Tout changement du schéma Dexie : nouvelle `version()` avec migration. Incrémenter `BACKUP_SCHEMA_VERSION` si le format de sauvegarde change.

## Commandes
```bash
npm install
npm run dev        # développement
npm test           # tests unitaires (doivent rester verts)
npm run build
npx vite preview --port 4173 & npm run test:e2e   # parcours Playwright iPhone + PC
```
Déploiement : push sur `main`, puis GitHub Actions publie sur GitHub Pages (`.github/workflows/deploy.yml`).
