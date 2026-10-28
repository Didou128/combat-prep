import { getExercise, resolveExercise } from './exercises'
import type { Environment, EquipmentId, Exercise, SessionTemplate, TemplateId, TemplateSlot } from './types'

export const TEMPLATES: Record<TemplateId, SessionTemplate> = {
  A: {
    id: 'A', name: 'A — Force bas du corps + tronc', short: 'Force jambes', legHeavy: true, explosive: false, durationMin: 60,
    focus: 'Squat, charnière de hanche, unilatéral, mollets, anti-rotation',
    slots: [
      { gym: 'goblet-squat', home: 'squat-sac', sets: 3, reps: [8, 12], restSec: 120, rirTarget: [1, 3] },
      { gym: 'rdl-halteres', home: 'rdl-sac', sets: 3, reps: [8, 12], restSec: 120, rirTarget: [1, 3] },
      { gym: 'split-squat-bulgare-halteres', home: 'split-squat-bulgare', sets: 3, reps: [8, 12], restSec: 90, rirTarget: [1, 3], note: 'Par jambe' },
      { gym: 'mollets-debout', home: 'mollets-unilateral', sets: 3, reps: [10, 15], restSec: 60, rirTarget: [1, 2] },
      { gym: 'pallof-poulie', home: 'pallof-elastique', sets: 3, reps: [8, 10], restSec: 60, note: 'Par côté, 2 s de maintien' },
    ],
  },
  B: {
    id: 'B', name: 'B — Force haut du corps', short: 'Force haut', legHeavy: false, explosive: false, durationMin: 60,
    focus: 'Poussée, tirage horizontal et vertical, épaules, bras',
    slots: [
      { gym: 'developpe-halteres', home: 'pompes-parallettes', sets: 3, reps: [8, 12], restSec: 120, rirTarget: [1, 3] },
      { gym: 'rowing-haltere', home: 'rowing-anneaux', sets: 3, reps: [8, 12], restSec: 120, rirTarget: [1, 3] },
      { gym: 'tirage-vertical', home: 'tractions-assistees', sets: 3, reps: [6, 10], restSec: 120, rirTarget: [1, 3] },
      { gym: 'developpe-militaire-halteres', home: 'pompes-pike', sets: 3, reps: [8, 12], restSec: 90, rirTarget: [1, 3] },
      { gym: 'curl-halteres', home: 'curl-anneaux', sets: 3, reps: [8, 12], restSec: 75, rirTarget: [1, 2] },
      { gym: 'extension-triceps-poulie', home: 'extension-triceps-elastique', sets: 2, reps: [10, 15], restSec: 60, rirTarget: [1, 2] },
    ],
  },
  C: {
    id: 'C', name: 'C — Explosivité + renforcement combat', short: 'Explosivité', legHeavy: true, explosive: true, durationMin: 55,
    focus: 'Puissance en début de séance, unilatéral, hanches, chevilles, épaules',
    slots: [
      { gym: 'squat-saute', home: 'squat-saute', sets: 3, reps: [4, 5], restSec: 120, note: 'Qualité maximale, arrête si la hauteur baisse' },
      { gym: 'lancer-mb-rotation', home: 'bond-lateral', sets: 3, reps: [4, 5], restSec: 90, note: 'Par côté' },
      { gym: 'fente-arriere-halteres', home: 'fente-arriere-sac', sets: 3, reps: [8, 10], restSec: 90, rirTarget: [2, 3], note: 'Par jambe' },
      { gym: 'hip-thrust', home: 'pont-fessier-unilateral', sets: 3, reps: [8, 12], restSec: 90, rirTarget: [1, 3] },
      { gym: 'equilibre-unipodal', home: 'equilibre-unipodal', sets: 2, durationSec: 30, restSec: 30, note: 'Par jambe' },
      { gym: 'face-pull', home: 'face-pull-elastique', sets: 3, reps: [12, 15], restSec: 60 },
      { gym: 'gainage-lateral', home: 'gainage-lateral', sets: 2, durationSec: 30, restSec: 45, note: 'Par côté' },
    ],
  },
  M10: {
    id: 'M10', name: 'Mobilité express (10 min)', short: 'Mobilité 10′', legHeavy: false, explosive: false, durationMin: 10,
    focus: 'Hanches, chevilles, colonne thoracique',
    slots: [
      { gym: 'mob-90-90', home: 'mob-90-90', sets: 1, durationSec: 90, restSec: 0 },
      { gym: 'mob-cheville-mur', home: 'mob-cheville-mur', sets: 1, reps: [10, 10], restSec: 0, note: 'Par côté' },
      { gym: 'mob-thoracique', home: 'mob-thoracique', sets: 1, reps: [8, 8], restSec: 0, note: 'Par côté' },
      { gym: 'etirement-quadriceps', home: 'etirement-quadriceps', sets: 1, durationSec: 45, restSec: 0, note: 'Par côté' },
      { gym: 'etirement-ischios', home: 'etirement-ischios', sets: 1, durationSec: 45, restSec: 0, note: 'Par côté' },
      { gym: 'respiration-recup', home: 'respiration-recup', sets: 1, durationSec: 90, restSec: 0 },
    ],
  },
  M20: {
    id: 'M20', name: 'Mobilité complète (20 min)', short: 'Mobilité 20′', legHeavy: false, explosive: false, durationMin: 20,
    focus: 'Récupération : hanches, adducteurs, ischios, épaules',
    slots: [
      { gym: 'mob-fente-dynamique', home: 'mob-fente-dynamique', sets: 1, reps: [6, 6], restSec: 0, note: 'Par côté' },
      { gym: 'mob-90-90', home: 'mob-90-90', sets: 2, durationSec: 60, restSec: 0 },
      { gym: 'mob-cheville-mur', home: 'mob-cheville-mur', sets: 2, reps: [10, 10], restSec: 0, note: 'Par côté' },
      { gym: 'mob-thoracique', home: 'mob-thoracique', sets: 2, reps: [8, 8], restSec: 0, note: 'Par côté' },
      { gym: 'etirement-ischios', home: 'etirement-ischios', sets: 2, durationSec: 45, restSec: 0, note: 'Par côté' },
      { gym: 'etirement-quadriceps', home: 'etirement-quadriceps', sets: 2, durationSec: 45, restSec: 0, note: 'Par côté' },
      { gym: 'etirement-adducteurs', home: 'etirement-adducteurs', sets: 2, durationSec: 60, restSec: 0 },
      { gym: 'etirement-pectoraux', home: 'etirement-pectoraux', sets: 1, durationSec: 45, restSec: 0, note: 'Par côté' },
      { gym: 'respiration-recup', home: 'respiration-recup', sets: 1, durationSec: 120, restSec: 0 },
    ],
  },
}

export const PREP_TEMPLATE_IDS: TemplateId[] = ['A', 'B', 'C']

export interface ResolvedSlot extends Omit<TemplateSlot, 'gym' | 'home'> {
  exercise: Exercise
  /** true si l'exercice prévu a été remplacé faute de matériel */
  substituted: boolean
  plannedExerciseId: string
  /** id de l'exercice choisi manuellement par l'utilisateur, le cas échéant */
}

/**
 * Construit la liste concrète des exercices d'une séance selon l'environnement,
 * le matériel disponible et la version allégée.
 */
export function buildSession(
  templateId: TemplateId,
  env: Environment,
  equipment: readonly EquipmentId[],
  light = false,
): ResolvedSlot[] {
  const tpl = TEMPLATES[templateId]
  const out: ResolvedSlot[] = []
  for (const slot of tpl.slots) {
    const wanted = env === 'gym' ? slot.gym : slot.home
    const ex = resolveExercise(wanted, equipment)
    if (!ex) continue
    if (light && ex.category === 'explosivite') continue // pas d'explosivité quand on est fatigué
    const { gym: _g, home: _h, ...rest } = slot
    out.push({
      ...rest,
      sets: light ? Math.max(1, slot.sets - 1) : slot.sets,
      rirTarget: light && slot.rirTarget ? [Math.max(2, slot.rirTarget[0]), Math.max(3, slot.rirTarget[1])] : slot.rirTarget,
      exercise: ex,
      substituted: ex.id !== wanted,
      plannedExerciseId: wanted,
    })
  }
  return out
}

export function templateLabel(id?: TemplateId): string {
  return id ? TEMPLATES[id].name : ''
}

export function substitutesFor(exerciseId: string, equipment: readonly EquipmentId[]): Exercise[] {
  const ex = getExercise(exerciseId)
  return ex.substitutes.map(getExercise).filter((s) => s.equipment.every((e) => equipment.includes(e)))
}
