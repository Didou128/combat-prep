import { addDays, todayISO, toISODate, weekStartOf } from './dates'
import { EXERCISES } from './exercises'
import type { PlannedSession, SetLog } from './types'

/**
 * Statistiques de progression, calculées uniquement à partir des données saisies.
 * Une période sans donnée reste à zéro / vide : rien n'est inventé ni interpolé.
 */

const EX_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))
const localDate = (isoDateTime: string) => toISODate(new Date(isoDateTime))

/** Les N lundis se terminant par la semaine de `today` (du plus ancien au plus récent). */
export function lastWeeks(n: number, today = todayISO()): string[] {
  const current = weekStartOf(today)
  return Array.from({ length: n }, (_, i) => addDays(current, -7 * (n - 1 - i)))
}

// ---------- Charges ----------

export interface LoadPoint {
  date: string // date locale de la séance
  workoutLogId: string
  bestLoadKg: number
  repsAtBest: number
  /** Estimation du maximum sur 1 répétition (Epley), seulement si la meilleure série fait ≤ 12 répétitions. */
  e1rmKg?: number
  sets: number
}

/** Exercices ayant au moins une série chargée, du plus pratiqué au moins pratiqué. */
export function exercisesWithLoad(sets: SetLog[]): { id: string; name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const s of sets) if (s.loadKg !== undefined && s.loadKg > 0) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1)
  return [...counts]
    .map(([id, count]) => ({ id, name: EX_BY_ID.get(id)?.name ?? id, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** Meilleure charge de chaque séance pour un exercice, dans l'ordre chronologique. */
export function loadProgress(exerciseId: string, sets: SetLog[]): LoadPoint[] {
  const byWorkout = new Map<string, SetLog[]>()
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || s.loadKg === undefined || s.loadKg <= 0) continue
    if (!byWorkout.has(s.workoutLogId)) byWorkout.set(s.workoutLogId, [])
    byWorkout.get(s.workoutLogId)!.push(s)
  }
  const points: LoadPoint[] = []
  for (const [workoutLogId, list] of byWorkout) {
    // Meilleure série : charge la plus haute, puis le plus de répétitions à cette charge.
    const best = list.reduce((b, s) => (s.loadKg! > b.loadKg! || (s.loadKg === b.loadKg && (s.reps ?? 0) > (b.reps ?? 0)) ? s : b))
    const reps = best.reps ?? 0
    const first = list.reduce((m, s) => (s.loggedAt < m ? s.loggedAt : m), list[0].loggedAt)
    points.push({
      date: localDate(first), workoutLogId, bestLoadKg: best.loadKg!, repsAtBest: reps, sets: list.length,
      e1rmKg: reps >= 1 && reps <= 12 ? Math.round(best.loadKg! * (1 + reps / 30) * 10) / 10 : undefined,
    })
  }
  return points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

// ---------- Volume ----------

export interface WeekVolume {
  weekStart: string
  /** Séries de travail (force, explosivité, renforcement), hors mobilité. */
  workSets: number
  /** Tonnage : somme répétitions × charge des séries chargées (kg). */
  tonnageKg: number
}

export function weeklyVolume(sets: SetLog[], weeks: string[]): WeekVolume[] {
  const map = new Map(weeks.map((w) => [w, { weekStart: w, workSets: 0, tonnageKg: 0 }]))
  for (const s of sets) {
    const ex = EX_BY_ID.get(s.exerciseId)
    if (!ex || ex.category === 'mobilite') continue
    const row = map.get(weekStartOf(localDate(s.loggedAt)))
    if (!row) continue
    row.workSets++
    if (s.loadKg && s.reps) row.tonnageKg += s.loadKg * s.reps
  }
  return weeks.map((w) => ({ ...map.get(w)!, tonnageKg: Math.round(map.get(w)!.tonnageKg) }))
}

// ---------- Assiduité ----------

export interface WeekAdherence {
  weekStart: string
  /** Séances de préparation dues : passées, ou déjà renseignées si elles sont aujourd'hui. */
  due: number
  done: number
  partial: number
  /** Annulées, ou encore « prévues » alors que la date est passée. */
  missed: number
  /** Séances de combat effectuées (AMHE, kick-boxing). */
  combatDone: number
}

export function weeklyAdherence(sessions: PlannedSession[], weeks: string[], today = todayISO()): WeekAdherence[] {
  const map = new Map(weeks.map((w) => [w, { weekStart: w, due: 0, done: 0, partial: 0, missed: 0, combatDone: 0 }]))
  for (const s of sessions) {
    const row = map.get(weekStartOf(s.date))
    if (!row) continue
    if ((s.kind === 'amhe' || s.kind === 'kickboxing') && s.status === 'done') row.combatDone++
    if (s.kind !== 'prep') continue
    const isDue = s.date < today || (s.date === today && s.status !== 'planned')
    if (!isDue) continue
    row.due++
    if (s.status === 'done') row.done++
    else if (s.status === 'partial') row.partial++
    else row.missed++
  }
  return weeks.map((w) => map.get(w)!)
}
