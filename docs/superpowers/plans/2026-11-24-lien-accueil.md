# Lien « ← Accueil » vers le hub — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher un lien « ← Accueil » vers le hub dans Combat Prep, seulement quand il est servi sous `/sport/`.

**Architecture:** Une fonction pure décide de l'adresse du hub à partir du chemin de base de la construction ; `App.tsx` affiche le lien (pastille en haut du contenu sur téléphone, première ligne du menu sur PC) si elle renvoie une adresse.

**Tech Stack:** React + TypeScript + Vite (combat-prep), vitest, Playwright (parcours du hub).

**Spec:** `docs/superpowers/specs/2026-11-24-lien-accueil-design.md`

## Global Constraints
- Libellé exact : `← Accueil`. Cible : `/`.
- Affiché seulement si `import.meta.env.BASE_URL === '/sport/'`.
- Téléphone (< 900 px) : dans le flux, en haut du contenu, pas en position fixe. PC (≥ 900 px) : au-dessus de la marque « CombatPrep » dans le menu latéral.
- Barre du bas et onglet « Accueil » de Combat Prep inchangés. Couleurs existantes uniquement.
- Tests unitaires lancés depuis PowerShell (`npx vitest run`) ; serveur local et Playwright autorisés par Dylan pour cette étape.

## Review Focus
- Version GitHub Pages (`BASE_URL` = `/combat-prep/`) : aucun lien → test unitaire de la fonction pure (Task 1).
- Développement local (`BASE_URL` = `/`) : aucun lien → même test (Task 1).
- Un seul lien visible à la fois (pas de doublon pastille + menu sur une même largeur) → vérifié par le parcours Playwright, qui clique un lien unique sur iPhone et sur PC (Task 2).
- Le lien ne masque pas le titre de la page sur iPhone → capture d'écran relue (Task 2).

---

### Task 1: Fonction `hubHref` et affichage du lien

**Files:**
- Create: `src/ui/hub.ts`
- Test: `src/ui/hub.test.ts`
- Modify: `src/App.tsx`, `src/index.css`

**Interfaces:**
- Produces: `hubHref(baseUrl: string): string | null` dans `src/ui/hub.ts`.

- [ ] **Step 1: Test qui échoue** — `src/ui/hub.test.ts` :
  `expect(hubHref('/sport/')).toBe('/')`, `expect(hubHref('/')).toBeNull()`, `expect(hubHref('/combat-prep/')).toBeNull()`.
- [ ] **Step 2:** `npx vitest run src/ui/hub.test.ts` → échoue (module absent).
- [ ] **Step 3:** Écrire `hubHref` ; dans `App.tsx`, calculer `hubHref(import.meta.env.BASE_URL)` et, si non nul, rendre un `<a className="hub-link">← Accueil</a>` en tête de `.nav` (classe `hub-link-nav`, visible ≥ 900 px) et en tête de `.main` (classe `hub-link-top`, visible < 900 px). Styles dans `index.css`.
- [ ] **Step 4:** `npx vitest run` → tout vert ; `npx tsc -b` sans erreur.

### Task 2: Parcours de bout en bout, puis commits

**Files:**
- Modify: `../hub/e2e/smoke.mjs`

- [ ] **Step 1:** Dans le parcours, après le retour du calendrier de Combat Prep : `await page.getByRole('link', { name: '← Accueil' }).click()` puis attendre le titre `Bonjour|Bonsoir Dylan`, et prendre une capture de Combat Prep sur iPhone avant le clic.
- [ ] **Step 2:** Dans `../hub` : `npm run build:all`, `npx vite preview --port 4174`, `node e2e/smoke.mjs` → `OK : parcours iPhone et PC`. Arrêter le serveur.
- [ ] **Step 3:** Relire la capture iPhone de Combat Prep : le lien ne recouvre pas le titre.
- [ ] **Step 4:** Commit dans combat-prep (code, spec, plan) et dans hub (test). Pas de push sans accord.
