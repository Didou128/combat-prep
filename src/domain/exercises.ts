import type { EquipmentId, Exercise } from './types'

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  barbell: 'Barre olympique',
  rack: 'Rack / cage',
  bench: 'Banc',
  dumbbells: 'Haltères',
  machines: 'Machines guidées',
  cable: 'Poulies',
  medball: 'Médecine-ball',
  cardio: 'Machines cardio',
  bands: 'Élastiques',
  parallettes: 'Parallettes',
  pullupBar: 'Barre de traction',
  rings: 'Anneaux',
  backpack: 'Sac à dos lesté',
  mat: 'Tapis de sol',
}

export const ALL_GYM_EQUIPMENT: EquipmentId[] = [
  'barbell', 'rack', 'bench', 'dumbbells', 'machines', 'cable', 'medball', 'cardio', 'bands', 'pullupBar', 'mat',
]

export const HOME_EQUIPMENT_CHOICES: EquipmentId[] = [
  'bands', 'parallettes', 'pullupBar', 'rings', 'backpack', 'dumbbells', 'medball', 'bench', 'mat',
]

export const MUSCLE_LABELS: Record<string, string> = {
  jambes: 'Jambes', fessiers: 'Fessiers', mollets: 'Mollets', dos: 'Dos', pectoraux: 'Pectoraux',
  epaules: 'Épaules', bras: 'Bras', tronc: 'Tronc / gainage', hanches: 'Hanches', chevilles: 'Chevilles',
  corps_entier: 'Corps entier',
}

export const CATEGORY_LABELS: Record<string, string> = {
  force: 'Force / hypertrophie',
  explosivite: 'Explosivité',
  specifique: 'Spécifique combat',
  mobilite: 'Mobilité',
}

export const EXERCISES: Exercise[] = [
  // ---------- JAMBES : force ----------
  {
    id: 'goblet-squat', name: 'Goblet squat', category: 'force', muscles: ['jambes', 'fessiers', 'tronc'],
    primaryMuscles: 'Quadriceps, fessiers, gainage', equipment: ['dumbbells'], level: 1, tracking: 'load',
    description: 'Squat en tenant un haltère contre la poitrine. Idéal pour apprendre le squat en gardant le buste droit.',
    cues: ['Pieds largeur d’épaules, pointes légèrement ouvertes', 'Descends entre les talons, coudes entre les genoux', 'Genoux dans l’axe des pieds', 'Remonte en poussant le sol, buste fier'],
    precautions: 'Arrête la descente si le bas du dos s’arrondit.',
    substitutes: ['squat-sac', 'squat-elastique', 'squat-tempo'],
  },
  {
    id: 'squat-barre', name: 'Squat barre', category: 'force', muscles: ['jambes', 'fessiers', 'tronc'],
    primaryMuscles: 'Quadriceps, fessiers, érecteurs', equipment: ['barbell', 'rack'], level: 2, tracking: 'load',
    description: 'Squat avec barre sur le haut du dos. À aborder quand le goblet squat est maîtrisé.',
    cues: ['Barre sur les trapèzes, gainage avant de descendre', 'Hanches et genoux plient ensemble', 'Descends au moins cuisses parallèles si la mobilité le permet', 'Règle les sécurités du rack'],
    precautions: 'Toujours avec sécurités. Apprends d’abord avec une charge légère.',
    substitutes: ['goblet-squat', 'squat-sac'],
  },
  {
    id: 'squat-sac', name: 'Squat avec sac lesté', category: 'force', muscles: ['jambes', 'fessiers', 'tronc'],
    primaryMuscles: 'Quadriceps, fessiers', equipment: ['backpack'], level: 1, tracking: 'load',
    description: 'Squat en portant un sac à dos lesté (bouteilles d’eau) contre la poitrine ou sur le dos.',
    cues: ['Serre le sac contre toi, il ne doit pas ballotter', 'Mêmes consignes que le goblet squat', 'Note le poids du sac'],
    substitutes: ['squat-elastique', 'squat-tempo'],
  },
  {
    id: 'squat-elastique', name: 'Squat avec élastique', category: 'force', muscles: ['jambes', 'fessiers'],
    primaryMuscles: 'Quadriceps, fessiers', equipment: ['bands'], level: 1, tracking: 'reps',
    description: 'Squat avec l’élastique sous les pieds et sur les épaules : la résistance augmente en haut du mouvement.',
    cues: ['Élastique bien centré sous les pieds', 'Contrôle la descente en 2–3 s', 'Note la couleur / tension de l’élastique'],
    substitutes: ['squat-tempo'],
  },
  {
    id: 'squat-tempo', name: 'Squat tempo au poids du corps', category: 'force', muscles: ['jambes', 'fessiers'],
    primaryMuscles: 'Quadriceps, fessiers', equipment: [], level: 1, tracking: 'reps',
    description: 'Squat lent (4 s de descente, 1 s de pause en bas) pour augmenter la difficulté sans charge.',
    cues: ['4 secondes de descente', 'Pause 1 s en bas sans relâcher', 'Remontée dynamique'],
    substitutes: [],
  },
  {
    id: 'rdl-halteres', name: 'Soulevé de terre roumain haltères', category: 'force', muscles: ['jambes', 'fessiers', 'dos'],
    primaryMuscles: 'Ischio-jambiers, fessiers, érecteurs', equipment: ['dumbbells'], level: 1, tracking: 'load',
    description: 'Charnière de hanche : on pousse les fesses en arrière, dos plat, haltères le long des jambes.',
    cues: ['Genoux légèrement fléchis et fixes', 'Pousse les hanches vers l’arrière', 'Dos neutre, haltères frôlent les cuisses', 'Remonte en serrant les fessiers'],
    precautions: 'Ne descends pas plus bas que ce que permet un dos plat.',
    substitutes: ['rdl-sac', 'good-morning-elastique', 'pont-fessier-unilateral'],
  },
  {
    id: 'rdl-sac', name: 'Soulevé de terre roumain avec sac', category: 'force', muscles: ['jambes', 'fessiers', 'dos'],
    primaryMuscles: 'Ischio-jambiers, fessiers', equipment: ['backpack'], level: 1, tracking: 'load',
    description: 'Même mouvement que le soulevé de terre roumain, sac tenu par les bretelles devant les cuisses. Version unijambe possible pour augmenter la difficulté.',
    cues: ['Dos plat', 'Hanches en arrière', 'Contrôle la descente'],
    substitutes: ['good-morning-elastique', 'pont-fessier-unilateral'],
  },
  {
    id: 'good-morning-elastique', name: 'Good morning élastique', category: 'force', muscles: ['jambes', 'fessiers', 'dos'],
    primaryMuscles: 'Ischio-jambiers, fessiers', equipment: ['bands'], level: 1, tracking: 'reps',
    description: 'Élastique sous les pieds et derrière la nuque, flexion de hanche dos plat.',
    cues: ['Dos plat', 'Genoux souples', 'Remonte en serrant les fessiers'],
    substitutes: ['pont-fessier-unilateral'],
  },
  {
    id: 'split-squat-bulgare-halteres', name: 'Split squat bulgare haltères', category: 'force', muscles: ['jambes', 'fessiers'],
    primaryMuscles: 'Quadriceps, fessiers, adducteurs', equipment: ['dumbbells', 'bench'], level: 2, tracking: 'load', perSide: true,
    description: 'Fente avec le pied arrière posé sur un banc. Excellent travail unilatéral pour les sports de combat.',
    cues: ['Pied avant assez loin du banc', 'Descends verticalement', 'Genou avant dans l’axe du pied', 'Commence par la jambe la plus faible'],
    precautions: 'Commence sans charge pour trouver l’équilibre.',
    substitutes: ['split-squat-bulgare', 'fente-arriere-sac'],
  },
  {
    id: 'split-squat-bulgare', name: 'Split squat bulgare (poids du corps / sac)', category: 'force', muscles: ['jambes', 'fessiers'],
    primaryMuscles: 'Quadriceps, fessiers', equipment: [], level: 1, tracking: 'reps', perSide: true,
    description: 'Pied arrière sur une chaise ou un canapé. Ajoute le sac lesté quand 3 × 12 est facile.',
    cues: ['Buste légèrement penché vers l’avant', 'Descente contrôlée 2–3 s', 'Pousse avec le talon avant'],
    substitutes: ['fente-arriere-sac'],
  },
  {
    id: 'fente-arriere-halteres', name: 'Fente arrière haltères', category: 'specifique', muscles: ['jambes', 'fessiers', 'hanches'],
    primaryMuscles: 'Quadriceps, fessiers, stabilité du genou', equipment: ['dumbbells'], level: 1, tracking: 'load', perSide: true,
    description: 'Pas en arrière puis retour. Proche des appuis de garde et des déplacements.',
    cues: ['Grand pas arrière', 'Genou arrière frôle le sol', 'Reviens en poussant sur le pied avant'],
    substitutes: ['fente-arriere-sac', 'split-squat-bulgare'],
  },
  {
    id: 'fente-arriere-sac', name: 'Fente arrière avec sac', category: 'specifique', muscles: ['jambes', 'fessiers', 'hanches'],
    primaryMuscles: 'Quadriceps, fessiers', equipment: ['backpack'], level: 1, tracking: 'load', perSide: true,
    description: 'Fente arrière avec sac à dos lesté.',
    cues: ['Sac bien serré', 'Contrôle le genou avant'],
    substitutes: ['split-squat-bulgare'],
  },
  {
    id: 'hip-thrust', name: 'Hip thrust', category: 'force', muscles: ['fessiers', 'hanches'],
    primaryMuscles: 'Fessiers, ischio-jambiers', equipment: ['barbell', 'bench'], level: 1, tracking: 'load',
    description: 'Haut du dos sur un banc, barre sur les hanches, extension de hanche.',
    cues: ['Menton rentré', 'Tibias verticaux en haut', 'Serre les fessiers 1 s en haut', 'Protège les hanches avec un coussin'],
    substitutes: ['pont-fessier-unilateral'],
  },
  {
    id: 'pont-fessier-unilateral', name: 'Pont fessier unilatéral', category: 'specifique', muscles: ['fessiers', 'hanches', 'tronc'],
    primaryMuscles: 'Fessiers, ischio-jambiers', equipment: [], level: 1, tracking: 'reps', perSide: true,
    description: 'Allongé sur le dos, une jambe tendue, on monte le bassin en poussant sur l’autre pied. Ajoute le sac sur les hanches pour progresser.',
    cues: ['Bassin bien horizontal', 'Pause 1 s en haut', 'Pousse avec le talon'],
    substitutes: [],
  },
  {
    id: 'mollets-debout', name: 'Mollets debout', category: 'force', muscles: ['mollets', 'chevilles'],
    primaryMuscles: 'Gastrocnémiens', equipment: ['dumbbells'], level: 1, tracking: 'load',
    description: 'Montées sur pointes sur une marche, haltère en main.',
    cues: ['Amplitude complète : talon sous la marche puis en haut', 'Pause 1 s en haut', 'Pas de rebond'],
    substitutes: ['mollets-unilateral'],
  },
  {
    id: 'mollets-unilateral', name: 'Mollets unilatéral sur marche', category: 'force', muscles: ['mollets', 'chevilles'],
    primaryMuscles: 'Gastrocnémiens, soléaire', equipment: [], level: 1, tracking: 'reps', perSide: true,
    description: 'Sur une jambe, sur une marche, en se tenant au mur. Sac lesté pour progresser.',
    cues: ['Descente lente 3 s', 'Montée complète', 'Pause en haut'],
    substitutes: [],
  },
  // ---------- TRONC ----------
  {
    id: 'pallof-poulie', name: 'Pallof press poulie', category: 'specifique', muscles: ['tronc'],
    primaryMuscles: 'Obliques, transverse (anti-rotation)', equipment: ['cable'], level: 1, tracking: 'reps', perSide: true,
    description: 'Debout de profil à la poulie, on pousse la poignée devant soi sans laisser le buste tourner.',
    cues: ['Bassin et épaules face à l’avant', 'Pousse lentement, tiens 2 s', 'Expire en poussant'],
    substitutes: ['pallof-elastique', 'gainage-lateral'],
  },
  {
    id: 'pallof-elastique', name: 'Pallof press élastique', category: 'specifique', muscles: ['tronc'],
    primaryMuscles: 'Obliques, transverse', equipment: ['bands'], level: 1, tracking: 'reps', perSide: true,
    description: 'Même exercice avec l’élastique accroché à une porte ou à la barre de traction.',
    cues: ['Résiste à la rotation', 'Tiens 2 s bras tendus'],
    substitutes: ['gainage-lateral'],
  },
  {
    id: 'gainage-lateral', name: 'Gainage latéral', category: 'specifique', muscles: ['tronc', 'hanches'],
    primaryMuscles: 'Obliques, moyen fessier', equipment: [], level: 1, tracking: 'time', perSide: true,
    description: 'Planche sur le côté, en appui sur l’avant-bras.',
    cues: ['Corps aligné', 'Bassin haut', 'Respire normalement'],
    substitutes: [],
  },
  {
    id: 'dead-bug', name: 'Dead bug', category: 'specifique', muscles: ['tronc'],
    primaryMuscles: 'Transverse, grand droit', equipment: [], level: 1, tracking: 'reps',
    description: 'Sur le dos, bras et jambes en l’air, on étend bras et jambe opposés en gardant le bas du dos au sol.',
    cues: ['Bas du dos plaqué au sol', 'Mouvements lents', 'Expire en étendant'],
    substitutes: [],
  },
  {
    id: 'releve-jambes-suspendu', name: 'Relevé de genoux suspendu', category: 'force', muscles: ['tronc'],
    primaryMuscles: 'Grand droit, fléchisseurs de hanche, grip', equipment: ['pullupBar'], level: 2, tracking: 'reps',
    description: 'Suspendu à la barre, on remonte les genoux vers la poitrine en enroulant le bassin.',
    cues: ['Pas de balancement', 'Enroule le bassin', 'Descente contrôlée'],
    substitutes: ['dead-bug'],
  },
  // ---------- HAUT DU CORPS : poussée ----------
  {
    id: 'developpe-halteres', name: 'Développé couché haltères', category: 'force', muscles: ['pectoraux', 'epaules', 'bras'],
    primaryMuscles: 'Pectoraux, triceps, deltoïdes antérieurs', equipment: ['dumbbells', 'bench'], level: 1, tracking: 'load',
    description: 'Allongé sur banc, on pousse les haltères vers le haut.',
    cues: ['Omoplates serrées et basses', 'Coudes à ~45° du buste', 'Descends jusqu’au niveau de la poitrine', 'Pieds ancrés au sol'],
    substitutes: ['pompes-parallettes', 'pompes'],
  },
  {
    id: 'developpe-couche-barre', name: 'Développé couché barre', category: 'force', muscles: ['pectoraux', 'epaules', 'bras'],
    primaryMuscles: 'Pectoraux, triceps', equipment: ['barbell', 'bench', 'rack'], level: 2, tracking: 'load',
    description: 'Développé couché classique à la barre.',
    cues: ['Omoplates serrées', 'Barre touche le bas des pectoraux', 'Avec un pareur ou des sécurités'],
    precautions: 'Toujours avec sécurités ou un partenaire.',
    substitutes: ['developpe-halteres', 'pompes-parallettes'],
  },
  {
    id: 'pompes', name: 'Pompes', category: 'force', muscles: ['pectoraux', 'epaules', 'bras', 'tronc'],
    primaryMuscles: 'Pectoraux, triceps', equipment: [], level: 1, tracking: 'reps',
    description: 'Pompes classiques. Progressions : pieds surélevés, tempo lent, sac lesté sur le dos.',
    cues: ['Corps gainé, aligné', 'Coudes à ~45°', 'Poitrine près du sol'],
    substitutes: [],
  },
  {
    id: 'pompes-parallettes', name: 'Pompes sur parallettes', category: 'force', muscles: ['pectoraux', 'epaules', 'bras', 'tronc'],
    primaryMuscles: 'Pectoraux, triceps', equipment: ['parallettes'], level: 1, tracking: 'reps',
    description: 'Les parallettes permettent de descendre plus bas : plus d’amplitude, poignets neutres.',
    cues: ['Descends sous le niveau des mains', 'Gainage', 'Remontée complète'],
    substitutes: ['pompes'],
  },
  {
    id: 'dips-anneaux', name: 'Dips (anneaux ou parallettes hautes)', category: 'force', muscles: ['pectoraux', 'bras', 'epaules'],
    primaryMuscles: 'Triceps, pectoraux', equipment: ['rings'], level: 3, tracking: 'reps',
    description: 'Dips aux anneaux : très exigeant en stabilité. Commence par des maintiens en haut.',
    cues: ['Épaules basses', 'Descends tant que les épaules restent confortables'],
    precautions: 'Exercice avancé : arrête au moindre inconfort d’épaule.',
    substitutes: ['pompes-parallettes'],
  },
  {
    id: 'developpe-militaire-halteres', name: 'Développé épaules haltères', category: 'force', muscles: ['epaules', 'bras'],
    primaryMuscles: 'Deltoïdes, triceps', equipment: ['dumbbells'], level: 1, tracking: 'load',
    description: 'Assis ou debout, on pousse les haltères au-dessus de la tête.',
    cues: ['Gainage, côtes rentrées', 'Coudes légèrement en avant', 'Pas de cambrure excessive'],
    substitutes: ['pompes-pike'],
  },
  {
    id: 'pompes-pike', name: 'Pompes pike', category: 'force', muscles: ['epaules', 'bras'],
    primaryMuscles: 'Deltoïdes, triceps', equipment: [], level: 2, tracking: 'reps',
    description: 'Pompes bassin haut (en V inversé) pour cibler les épaules. Pieds surélevés pour progresser.',
    cues: ['Tête vers l’avant des mains', 'Coudes vers l’arrière', 'Contrôle la descente'],
    substitutes: ['pompes'],
  },
  {
    id: 'extension-triceps-poulie', name: 'Extension triceps poulie', category: 'force', muscles: ['bras'],
    primaryMuscles: 'Triceps', equipment: ['cable'], level: 1, tracking: 'load',
    description: 'Debout face à la poulie haute, on tend les coudes vers le bas.',
    cues: ['Coudes fixes près du corps', 'Extension complète'],
    substitutes: ['extension-triceps-elastique'],
  },
  {
    id: 'extension-triceps-elastique', name: 'Extension triceps élastique', category: 'force', muscles: ['bras'],
    primaryMuscles: 'Triceps', equipment: ['bands'], level: 1, tracking: 'reps',
    description: 'Élastique accroché en hauteur, extension des coudes.',
    cues: ['Coudes fixes', 'Pause en extension'],
    substitutes: ['pompes'],
  },
  // ---------- HAUT DU CORPS : tirage ----------
  {
    id: 'rowing-haltere', name: 'Rowing haltère un bras', category: 'force', muscles: ['dos', 'bras'],
    primaryMuscles: 'Grand dorsal, rhomboïdes, biceps', equipment: ['dumbbells', 'bench'], level: 1, tracking: 'load', perSide: true,
    description: 'Un genou et une main sur le banc, on tire l’haltère vers la hanche.',
    cues: ['Dos plat', 'Tire le coude vers la hanche', 'Contrôle la descente'],
    substitutes: ['rowing-anneaux', 'rowing-elastique'],
  },
  {
    id: 'rowing-anneaux', name: 'Rowing inversé aux anneaux', category: 'force', muscles: ['dos', 'bras', 'tronc'],
    primaryMuscles: 'Dorsaux, rhomboïdes, biceps', equipment: ['rings'], level: 1, tracking: 'reps',
    description: 'Corps incliné sous les anneaux, on tire la poitrine vers les mains. Plus le corps est horizontal, plus c’est dur.',
    cues: ['Corps gainé comme une planche', 'Serre les omoplates en haut', 'Ajuste l’inclinaison pour rester dans la fourchette'],
    substitutes: ['rowing-elastique'],
  },
  {
    id: 'rowing-elastique', name: 'Rowing élastique', category: 'force', muscles: ['dos', 'bras'],
    primaryMuscles: 'Dorsaux, rhomboïdes', equipment: ['bands'], level: 1, tracking: 'reps',
    description: 'Élastique accroché devant soi, on tire vers le ventre.',
    cues: ['Omoplates serrées', 'Pause 1 s'],
    substitutes: [],
  },
  {
    id: 'tirage-vertical', name: 'Tirage vertical poulie', category: 'force', muscles: ['dos', 'bras'],
    primaryMuscles: 'Grand dorsal, biceps', equipment: ['cable'], level: 1, tracking: 'load',
    description: 'Assis, on tire la barre vers le haut de la poitrine.',
    cues: ['Poitrine sortie', 'Tire les coudes vers les côtes', 'Remontée contrôlée'],
    substitutes: ['tractions-assistees', 'tractions-negatives'],
  },
  {
    id: 'tractions', name: 'Tractions', category: 'force', muscles: ['dos', 'bras'],
    primaryMuscles: 'Grand dorsal, biceps', equipment: ['pullupBar'], level: 2, tracking: 'reps',
    description: 'Tractions pronation ou supination. Si moins de 5 répétitions : utilise la version assistée ou les négatives.',
    cues: ['Départ bras tendus', 'Menton au-dessus de la barre', 'Pas d’élan'],
    substitutes: ['tractions-assistees', 'tractions-negatives', 'rowing-anneaux'],
  },
  {
    id: 'tractions-assistees', name: 'Tractions assistées élastique', category: 'force', muscles: ['dos', 'bras'],
    primaryMuscles: 'Grand dorsal, biceps', equipment: ['pullupBar', 'bands'], level: 1, tracking: 'reps',
    description: 'Élastique accroché à la barre sous les pieds ou les genoux pour alléger. Diminue la tension de l’élastique pour progresser.',
    cues: ['Amplitude complète', 'Note la couleur de l’élastique'],
    substitutes: ['tractions-negatives', 'rowing-anneaux'],
  },
  {
    id: 'tractions-negatives', name: 'Tractions négatives', category: 'force', muscles: ['dos', 'bras'],
    primaryMuscles: 'Grand dorsal, biceps', equipment: ['pullupBar'], level: 1, tracking: 'reps',
    description: 'On saute menton au-dessus de la barre, puis on descend lentement (4–5 s).',
    cues: ['Descente de 4–5 s', 'Contrôle jusqu’en bas'],
    substitutes: ['rowing-anneaux'],
  },
  {
    id: 'face-pull', name: 'Face pull poulie', category: 'specifique', muscles: ['epaules', 'dos'],
    primaryMuscles: 'Deltoïdes postérieurs, rotateurs externes', equipment: ['cable'], level: 1, tracking: 'load',
    description: 'Corde à hauteur du visage, on tire vers le front en écartant les mains. Prévention des épaules.',
    cues: ['Coudes hauts', 'Écarte la corde en fin de mouvement', 'Charge légère, mouvement propre'],
    substitutes: ['face-pull-elastique'],
  },
  {
    id: 'face-pull-elastique', name: 'Face pull élastique', category: 'specifique', muscles: ['epaules', 'dos'],
    primaryMuscles: 'Deltoïdes postérieurs, rotateurs externes', equipment: ['bands'], level: 1, tracking: 'reps',
    description: 'Même exercice avec un élastique accroché à hauteur du visage.',
    cues: ['Coudes hauts', 'Pause 1 s'],
    substitutes: ['ytw-sol'],
  },
  {
    id: 'ytw-sol', name: 'Y-T-W au sol', category: 'specifique', muscles: ['epaules', 'dos'],
    primaryMuscles: 'Trapèzes inférieurs, deltoïdes postérieurs', equipment: [], level: 1, tracking: 'reps',
    description: 'Allongé sur le ventre, on lève les bras en Y, en T puis en W.',
    cues: ['Pouces vers le ciel', 'Mouvement lent'],
    substitutes: [],
  },
  // ---------- BRAS ----------
  {
    id: 'curl-halteres', name: 'Curl biceps haltères', category: 'force', muscles: ['bras'],
    primaryMuscles: 'Biceps, brachial', equipment: ['dumbbells'], level: 1, tracking: 'load',
    description: 'Flexion des coudes avec haltères, debout ou assis.',
    cues: ['Coudes fixes le long du corps', 'Pas d’élan avec le dos', 'Descente lente 2–3 s'],
    substitutes: ['curl-elastique', 'curl-anneaux'],
  },
  {
    id: 'curl-elastique', name: 'Curl élastique', category: 'force', muscles: ['bras'],
    primaryMuscles: 'Biceps', equipment: ['bands'], level: 1, tracking: 'reps',
    description: 'Élastique sous les pieds, flexion des coudes.',
    cues: ['Coudes fixes', 'Pause en haut'],
    substitutes: ['curl-anneaux'],
  },
  {
    id: 'curl-anneaux', name: 'Curl aux anneaux', category: 'force', muscles: ['bras'],
    primaryMuscles: 'Biceps', equipment: ['rings'], level: 1, tracking: 'reps',
    description: 'Corps incliné sous les anneaux, on ramène les mains vers le front en ne pliant que les coudes.',
    cues: ['Corps gainé', 'Coudes devant soi', 'Inclinaison = difficulté'],
    substitutes: [],
  },
  // ---------- EXPLOSIVITÉ ----------
  {
    id: 'squat-saute', name: 'Squat sauté', category: 'explosivite', muscles: ['jambes', 'fessiers', 'corps_entier'],
    primaryMuscles: 'Quadriceps, fessiers, mollets', equipment: [], level: 1, tracking: 'reps',
    description: 'Quart à demi-squat puis saut vertical maximal. Qualité avant quantité.',
    cues: ['Chaque saut à intensité maximale', 'Réception souple, genoux dans l’axe', 'Repos complet entre les séries', 'Arrête la série si la hauteur baisse nettement'],
    precautions: 'Sur un sol amortissant. Pas en état de fatigue.',
    substitutes: [],
  },
  {
    id: 'bond-lateral', name: 'Bonds latéraux (skater jumps)', category: 'explosivite', muscles: ['jambes', 'hanches', 'chevilles'],
    primaryMuscles: 'Fessiers, adducteurs, stabilité cheville', equipment: [], level: 1, tracking: 'reps', perSide: true,
    description: 'Bond latéral d’un pied sur l’autre avec stabilisation 1 s à chaque réception. Travaille les déplacements latéraux.',
    cues: ['Pousse fort sur le côté', 'Stabilise 1 s à la réception', 'Genou au-dessus du pied'],
    substitutes: ['squat-saute'],
  },
  {
    id: 'lancer-mb-rotation', name: 'Lancer médecine-ball en rotation', category: 'explosivite', muscles: ['tronc', 'hanches', 'corps_entier'],
    primaryMuscles: 'Obliques, hanches, chaîne de rotation', equipment: ['medball'], level: 1, tracking: 'reps', perSide: true,
    description: 'De profil face à un mur, on lance le médecine-ball avec une rotation hanches puis épaules. Transfert direct vers les frappes.',
    cues: ['La rotation part des hanches et des pieds', 'Lancer à intensité maximale', 'Ballon de 3–5 kg'],
    substitutes: ['rotation-explosive-elastique', 'bond-lateral'],
  },
  {
    id: 'lancer-mb-poitrine', name: 'Lancer médecine-ball poitrine', category: 'explosivite', muscles: ['pectoraux', 'bras', 'corps_entier'],
    primaryMuscles: 'Pectoraux, triceps, chaîne de poussée', equipment: ['medball'], level: 1, tracking: 'reps',
    description: 'En garde, on pousse le ballon contre un mur en extension explosive.',
    cues: ['Pousse avec les jambes et les bras', 'Récupère et relance sans rebond inutile'],
    substitutes: ['pompes-explosives'],
  },
  {
    id: 'pompes-explosives', name: 'Pompes explosives', category: 'explosivite', muscles: ['pectoraux', 'bras'],
    primaryMuscles: 'Pectoraux, triceps', equipment: [], level: 2, tracking: 'reps',
    description: 'Pompes poussées le plus vite possible (mains qui décollent si possible).',
    cues: ['Vitesse maximale vers le haut', 'Réception contrôlée', 'Version sur genoux pour débuter'],
    substitutes: ['pompes'],
  },
  {
    id: 'rotation-explosive-elastique', name: 'Rotation explosive élastique', category: 'explosivite', muscles: ['tronc', 'hanches'],
    primaryMuscles: 'Obliques, hanches', equipment: ['bands'], level: 1, tracking: 'reps', perSide: true,
    description: 'Élastique accroché sur le côté, rotation rapide du tronc en pivotant le pied arrière comme pour un crochet.',
    cues: ['Pivote le pied arrière', 'Retour lent, aller rapide'],
    substitutes: [],
  },
  // ---------- STABILITÉ / SPÉCIFIQUE ----------
  {
    id: 'equilibre-unipodal', name: 'Équilibre unipodal dynamique', category: 'specifique', muscles: ['chevilles', 'jambes', 'hanches'],
    primaryMuscles: 'Stabilisateurs de cheville et de genou', equipment: [], level: 1, tracking: 'time', perSide: true,
    description: 'Sur un pied, genou légèrement fléchi, on touche des cibles imaginaires avec l’autre pied (avant, côté, arrière).',
    cues: ['Genou dans l’axe du pied', 'Pied stable, orteils détendus', 'Progression : yeux fermés ou sur coussin'],
    substitutes: [],
  },
  {
    id: 'copenhague', name: 'Planche Copenhague (version genou)', category: 'specifique', muscles: ['hanches', 'tronc'],
    primaryMuscles: 'Adducteurs, obliques', equipment: ['bench'], level: 2, tracking: 'time', perSide: true,
    description: 'Gainage latéral avec le genou du dessus posé sur un banc. Renforce les adducteurs, souvent blessés dans les sports de combat.',
    cues: ['Bassin haut', 'Version genou d’abord', 'Courtes durées au début'],
    substitutes: ['gainage-lateral'],
  },
  // ---------- MOBILITÉ ----------
  {
    id: 'mob-90-90', name: 'Hanches 90/90', category: 'mobilite', muscles: ['hanches'], mobilityType: 'dynamique',
    primaryMuscles: 'Rotateurs de hanche', equipment: [], level: 1, tracking: 'time',
    description: 'Assis, jambes à 90° devant et derrière, on bascule les genoux d’un côté à l’autre.',
    cues: ['Buste droit', 'Mouvement lent', 'Respiration calme'],
    substitutes: [],
  },
  {
    id: 'mob-cheville-mur', name: 'Mobilité cheville genou au mur', category: 'mobilite', muscles: ['chevilles'], mobilityType: 'dynamique', perSide: true,
    primaryMuscles: 'Mollets, articulation de la cheville', equipment: [], level: 1, tracking: 'reps',
    description: 'Pied à quelques centimètres du mur, on amène le genou vers le mur sans décoller le talon.',
    cues: ['Talon au sol', 'Genou dans l’axe du 2e orteil'],
    substitutes: [],
  },
  {
    id: 'mob-thoracique', name: 'Rotation thoracique à quatre pattes', category: 'mobilite', muscles: ['dos', 'epaules'], mobilityType: 'dynamique', perSide: true,
    primaryMuscles: 'Colonne thoracique', equipment: [], level: 1, tracking: 'reps',
    description: 'À quatre pattes, main derrière la tête, on ouvre le coude vers le plafond.',
    cues: ['Bassin immobile', 'Suis le coude du regard'],
    substitutes: [],
  },
  {
    id: 'mob-fente-dynamique', name: 'Fente du coureur avec rotation', category: 'mobilite', muscles: ['hanches', 'jambes'], mobilityType: 'dynamique', perSide: true,
    primaryMuscles: 'Fléchisseurs de hanche, adducteurs, thoracique', equipment: [], level: 1, tracking: 'reps',
    description: 'Grande fente, main au sol à l’intérieur du pied avant, puis rotation du bras vers le ciel.',
    cues: ['Jambe arrière tendue', 'Rotation ample'],
    substitutes: [],
  },
  {
    id: 'etirement-ischios', name: 'Étirement ischio-jambiers', category: 'mobilite', muscles: ['jambes'], mobilityType: 'statique', perSide: true,
    primaryMuscles: 'Ischio-jambiers', equipment: [], level: 1, tracking: 'time',
    description: 'Allongé sur le dos, jambe tendue vers le ciel avec une serviette ou un élastique.',
    cues: ['Dos au sol', 'Tension modérée, jamais de douleur', 'Respire profondément'],
    substitutes: [],
  },
  {
    id: 'etirement-quadriceps', name: 'Étirement quadriceps / psoas en fente', category: 'mobilite', muscles: ['jambes', 'hanches'], mobilityType: 'statique', perSide: true,
    primaryMuscles: 'Quadriceps, psoas', equipment: [], level: 1, tracking: 'time',
    description: 'Genou arrière au sol, on serre le fessier et on avance doucement le bassin.',
    cues: ['Serre le fessier arrière', 'Ne cambre pas'],
    substitutes: [],
  },
  {
    id: 'etirement-adducteurs', name: 'Étirement adducteurs (grenouille)', category: 'mobilite', muscles: ['hanches'], mobilityType: 'statique',
    primaryMuscles: 'Adducteurs', equipment: [], level: 1, tracking: 'time',
    description: 'À quatre pattes, genoux écartés, on recule doucement le bassin.',
    cues: ['Progressif', 'Aucune douleur à l’aine'],
    substitutes: [],
  },
  {
    id: 'etirement-pectoraux', name: 'Étirement pectoraux / épaules au mur', category: 'mobilite', muscles: ['pectoraux', 'epaules'], mobilityType: 'statique', perSide: true,
    primaryMuscles: 'Pectoraux, deltoïdes antérieurs', equipment: [], level: 1, tracking: 'time',
    description: 'Avant-bras contre un montant de porte, on tourne doucement le buste à l’opposé.',
    cues: ['Coude à hauteur d’épaule', 'Tension douce'],
    substitutes: [],
  },
  {
    id: 'respiration-recup', name: 'Respiration de récupération', category: 'mobilite', muscles: ['corps_entier'], mobilityType: 'statique',
    primaryMuscles: 'Système nerveux (retour au calme)', equipment: [], level: 1, tracking: 'time',
    description: 'Allongé, jambes surélevées : inspire 4 s, expire 6–8 s.',
    cues: ['Expiration plus longue que l’inspiration', 'Relâche les épaules'],
    substitutes: [],
  },
]

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))

export function getExercise(id: string): Exercise {
  const ex = BY_ID.get(id)
  if (!ex) throw new Error(`Exercice inconnu : ${id}`)
  return ex
}

export function isAvailable(ex: Exercise, equipment: readonly EquipmentId[]): boolean {
  return ex.equipment.every((e) => equipment.includes(e))
}

/**
 * Renvoie l'exercice préféré s'il est réalisable, sinon le premier remplaçant réalisable
 * (recherche en profondeur dans les remplaçants), sinon null.
 */
export function resolveExercise(id: string, equipment: readonly EquipmentId[]): Exercise | null {
  const seen = new Set<string>()
  const queue = [id]
  while (queue.length) {
    const cur = queue.shift()!
    if (seen.has(cur)) continue
    seen.add(cur)
    const ex = getExercise(cur)
    if (isAvailable(ex, equipment)) return ex
    queue.push(...ex.substitutes)
  }
  return null
}
