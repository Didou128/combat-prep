# Combat Prep

Application (PWA) de planification de la préparation physique autour du **kick-boxing** (jour variable) et des **AMHE** (dimanche). Utilisable sur iPhone et PC, en français, fonctionne hors ligne.

## Fonctionnalités de la V1

- **Calendrier hebdomadaire** du lundi au dimanche : navigation entre les semaines, couleurs par type (combat, force, explosivité, mobilité, repos).
- **AMHE** créé automatiquement le dimanche (13 h – 17 h) et **kick-boxing** au jour habituel. Le jour du kick-boxing se change **pour une seule semaine**, sans toucher aux semaines suivantes.
- **Gestion des séances** : déplacer (glisser sur PC, choix du jour sur iPhone), modifier l’heure et la durée, ajouter, supprimer (avec confirmation), reporter au lendemain, statut prévue / terminée / partielle / annulée.
- **Génération d’une semaine** de 3 séances (A force jambes, B force haut du corps, C explosivité et renforcement spécifique), plus de la mobilité, avec les règles suivantes :
  - pas de séance jambes la veille d’un combat, ni le jour même ;
  - 48 h minimum entre deux séances jambes ;
  - rien de lourd le samedi ;
  - si les règles ne peuvent pas être respectées, une séance est retirée plutôt qu’entassée.
- **Avertissements** sur les conflits horaires et les enchaînements fatigants. Rien n’est jamais bloqué.
- **Copie de la semaine précédente.**
- **Versions salle et domicile** pour chaque séance, avec remplacement automatique selon le matériel déclaré.
- **Version allégée** (« Je suis fatigué ») ou remplacement par 20 minutes de mobilité.
- **Mode entraînement** :
  - saisie des séries (répétitions, charge, RIR, qualité pour l’explosivité) ;
  - chronomètre de repos qui reste juste même si l’écran se verrouille ;
  - remplacement d’un exercice, arrêt ou fin de séance.
- **Double progression** : propose la charge et les répétitions de la séance suivante d’après l’historique.
- **Compte rendu des combats** : durée, intensité et fatigue.
- **Bibliothèque** de 55 exercices, avec filtres (objectif, muscle, salle/domicile, niveau).
- **Sauvegarde** : export et import d’un fichier JSON, pour passer de l’iPhone au PC.

## Ajouts de l’étape 4

- **Page Progrès** (onglets) :
  - **Graphiques** sur 4, 8, 12 ou 26 semaines : meilleure charge par séance pour chaque exercice (avec un 1RM estimé indicatif), volume hebdomadaire (séries et tonnage), assiduité (séances faites, partielles, manquées). Chaque graphique a une info-bulle (survol, toucher, clavier) et un tableau des données. Sans donnée, un message l’indique : aucune valeur n’est inventée.
  - **Historique** des séances passées, des plus récentes aux plus anciennes : statut, séries réalisées, ressenti, notes, comptes rendus de combat.
  - **Récupération** : courbe du score sur 30 jours et tableau des saisies.
- **Suivi de la récupération** : sur l’accueil, un point du jour en 30 secondes (heures de sommeil, puis qualité du sommeil, énergie, fatigue, courbatures et motivation notées de 1 à 5). Il produit un score sur 100, un niveau (bon, moyen, insuffisant) et des **suggestions prudentes, présentées comme indicatives** : version allégée, mobilité, sommeil, semaine plus légère si la fatigue dure 3 jours. Le rappel s’affiche aussi sur la séance du jour.
- **Séances manquées** : une séance de préparation passée et non faite apparaît sur l’accueil avec des options :
  - la déplacer sur un jour libre de **la même semaine**, en respectant toutes les règles du planificateur ;
  - remplacer une séance moins prioritaire (ordre A, puis C, puis B) ;
  - ne pas la rattraper.

  On ne met jamais deux séances le même jour et on ne reporte rien à la semaine suivante. La séance non faite est marquée « annulée », jamais supprimée.
- **Mobilité** : nouvelles routines de **5 min** (réveil articulaire) et **15 min** (récupération), sans matériel, lançables depuis l’accueil. La fatigue propose désormais la routine de 15 min.

## Lancer en local

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # tests unitaires (Vitest)
npm run build && npx vite preview --port 4173
npm run test:e2e     # parcours complet dans Chromium (iPhone + PC), nécessite le preview lancé et Playwright
# Pour utiliser Edge ou Chrome déjà installés : PW_CHANNEL=msedge (ou chrome) npm run test:e2e
```

## Mise en ligne (GitHub Pages)

1. Pousser le projet sur la branche `main` d’un dépôt GitHub.
2. Dans le dépôt : **Settings → Pages → Source : GitHub Actions**.
3. Le workflow `.github/workflows/deploy.yml` lance les tests, compile et publie l’application à l’adresse `https://<utilisateur>.github.io/<dépôt>/`.

## Installation sur iPhone

Ouvrir l’adresse dans **Safari**, puis **Partager → Sur l’écran d’accueil**. L’application s’ouvre ensuite en plein écran et fonctionne hors ligne.

Sur PC (Chrome ou Edge) : utiliser l’icône **Installer** dans la barre d’adresse.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/domain/` | Logique pure et testée : dates, bibliothèque d’exercices, séances types, générateur de semaine, détection des conflits, progression, statistiques, récupération, réorganisation des séances manquées |
| `src/db/` | Base locale IndexedDB (Dexie), opérations, sauvegarde et restauration |
| `src/pages/`, `src/ui/` | Interface React (graphiques SVG maison dans `src/ui/charts.tsx`, sans dépendance) |

Une **séance type** (A, B, C, M10, M20) est un modèle défini dans le code. Une **séance planifiée** est une occurrence datée stockée dans la base. Les règles récurrentes (AMHE, kick-boxing) ne servent qu’à créer les occurrences de chaque semaine **à sa première ouverture**. Les semaines passées ne sont jamais remplies automatiquement.

## Limites connues

- **Pas de synchronisation automatique.** Les données restent sur chaque appareil : utiliser l’export/import. Exporte régulièrement, car iOS peut effacer les données d’un site web non installé.
- **iPhone :**
  - pas de notifications en V1 ;
  - le chronomètre ne sonne pas en arrière-plan, mais il reste juste à la réouverture ;
  - pas de vibration ;
  - pas d’accès à Apple Santé.
- **Récupération :** le score et les seuils sont des règles simples (voir `src/domain/recovery.ts`), sans validation scientifique. Ils ne posent pas de diagnostic.
- **Graphiques :** le 1RM estimé (formule d’Epley) n’est qu’un ordre de grandeur.
- **Bibliothèque fixe :** les exercices sont définis dans le code (pas encore d’exercices personnalisés).

Les recommandations sont indicatives et ne remplacent pas l’avis d’un professionnel de santé.
