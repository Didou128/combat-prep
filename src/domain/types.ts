// Modèles de données de l'application.

/** Index du jour dans la semaine : 0 = lundi … 6 = dimanche. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type SessionKind =
  | 'amhe'
  | 'kickboxing'
  | 'prep' // préparation physique (séance type A/B/C)
  | 'mobility'
  | 'other'

export type SessionStatus = 'planned' | 'done' | 'partial' | 'cancelled'
export type SessionSource = 'recurring' | 'generated' | 'manual' | 'copied'
export type Environment = 'gym' | 'home'

/** Occurrence datée d'une séance dans le calendrier. */
export interface PlannedSession {
  id: string
  date: string // YYYY-MM-DD (date locale)
  startTime: string // HH:MM
  durationMin: number
  kind: SessionKind
  templateId?: TemplateId
  environment?: Environment
  light?: boolean // version allégée (fatigue)
  status: SessionStatus
  source: SessionSource
  title?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export type TemplateId = 'A' | 'B' | 'C' | 'M10' | 'M20'

export type EquipmentId =
  | 'barbell'
  | 'rack'
  | 'bench'
  | 'dumbbells'
  | 'machines'
  | 'cable'
  | 'medball'
  | 'cardio'
  | 'bands'
  | 'parallettes'
  | 'pullupBar'
  | 'rings'
  | 'backpack'
  | 'mat'

export interface RecurringSlot {
  weekday: DayIndex
  startTime: string
  durationMin: number
}

export interface Settings {
  id: 'main'
  level: 'debutant' | 'intermediaire' | 'avance'
  goal: 'masse_force' | 'explosivite' | 'mixte'
  prepSessionsPerWeek: 2 | 3 | 4
  prepDurationMin: number
  prepDefaultTime: string
  gymSessionsPerWeek: number
  amhe: RecurringSlot
  kickboxing: RecurringSlot
  homeEquipment: EquipmentId[]
  gymEquipment: EquipmentId[]
  backpackMaxKg: number
  dumbbellIncrementKg: number
  barbellIncrementKg: number
  lastExportAt?: string
}

/** Semaine déjà initialisée (occurrences récurrentes créées). */
export interface WeekRecord {
  weekStart: string // lundi YYYY-MM-DD
  initializedAt: string
}

export interface WorkoutLog {
  id: string
  plannedSessionId: string
  templateId?: TemplateId
  environment?: Environment
  startedAt: string
  endedAt?: string
  status: 'in_progress' | 'done' | 'partial' | 'abandoned'
  feeling?: number // 1–10
  notes?: string
}

export interface SetLog {
  id: string
  workoutLogId: string
  exerciseId: string
  setIndex: number
  reps?: number
  loadKg?: number
  durationSec?: number
  rir?: number
  variant?: string
  quality?: number // explosivité : qualité technique 1–5
  loggedAt: string
}

export interface CombatLog {
  id: string
  plannedSessionId: string
  date: string
  discipline: 'amhe' | 'kickboxing'
  durationMin: number
  intensity: number // 1–10
  fatigueAfter: number // 1–10
  notes?: string
  loggedAt: string
}

// ---------- Bibliothèque ----------

export type ExerciseCategory = 'force' | 'explosivite' | 'specifique' | 'mobilite'
export type MuscleGroup =
  | 'jambes'
  | 'fessiers'
  | 'mollets'
  | 'dos'
  | 'pectoraux'
  | 'epaules'
  | 'bras'
  | 'tronc'
  | 'hanches'
  | 'chevilles'
  | 'corps_entier'

export type Tracking = 'load' | 'reps' | 'time'

export interface Exercise {
  id: string
  name: string
  category: ExerciseCategory
  muscles: MuscleGroup[]
  primaryMuscles: string
  /** Matériel nécessaire (tous requis). Vide = poids du corps. */
  equipment: EquipmentId[]
  level: 1 | 2 | 3
  tracking: Tracking
  description: string
  cues: string[]
  precautions?: string
  /** Remplacements par ordre de préférence. */
  substitutes: string[]
  /** Pour les exercices de mobilité : dynamique (avant) ou statique (après). */
  mobilityType?: 'dynamique' | 'statique'
  perSide?: boolean
}

export interface TemplateSlot {
  gym: string
  home: string
  sets: number
  reps?: [number, number]
  durationSec?: number
  restSec: number
  rirTarget?: [number, number]
  note?: string
}

export interface SessionTemplate {
  id: TemplateId
  name: string
  short: string
  focus: string
  legHeavy: boolean
  explosive: boolean
  durationMin: number
  slots: TemplateSlot[]
}
