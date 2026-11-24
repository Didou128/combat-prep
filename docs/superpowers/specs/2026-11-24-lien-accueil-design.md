# Lien « ← Accueil » vers le hub — conception courte

## Intention
Depuis Combat Prep, revenir à la page d'accueil centrale (hub) en un geste, comme depuis le Pomodoro.
Dylan veut que l'ensemble se vive comme une seule app.

## Objectifs / non-objectifs
- Objectif : un lien « ← Accueil » visible sur toutes les pages de Combat Prep quand il est ouvert depuis le hub (`/sport/`).
- Non-objectif : changer la barre de navigation du bas (5 onglets, dont l'« Accueil » propre à Combat Prep, inchangé).
- Anti-objectif : un lien qui mène nulle part. Sur la version GitHub Pages (pas de hub), le lien n'apparaît pas.

## Approches envisagées
- **A (retenue par Dylan)** : petit lien en haut de l'écran sur téléphone, en haut du menu latéral sur PC. Barre du bas intacte.
- B : 6ᵉ onglet « Accueil » et renommage de l'onglet actuel en « Aujourd'hui ». Plus visible, mais barre serrée sur iPhone.

## Ce qui est décidé
- Condition d'affichage : Combat Prep construit pour le hub, c'est-à-dire `import.meta.env.BASE_URL === '/sport/'`. Cible du lien : `/`.
- Téléphone (< 900 px) : lien discret en forme de pastille, en haut du contenu, dans le flux de la page (pas en position fixe, pour ne pas recouvrir les titres).
- PC (≥ 900 px) : première ligne du menu latéral, au-dessus de « CombatPrep ».
- Même libellé que le Pomodoro : « ← Accueil ».

## Laissé au constructeur (mes choix, à corriger si besoin)
- Le style reprend les couleurs de Combat Prep (texte atténué, bordure fine), sans nouvelle couleur.
- Test : le parcours Playwright du hub vérifie l'aller-retour hub → `/sport/` → « ← Accueil » → hub, sur iPhone et PC.
