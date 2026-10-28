import type { Exercise, SetLog } from './types'

/**
 * Double progression avec RIR.
 * - On garde la charge et on ajoute des répétitions jusqu'au haut de la fourchette.
 * - Quand TOUTES les séries atteignent le haut de la fourchette avec RIR ≥ 1 : +incrément minimal.
 * - Si les répétitions baissent deux séances de suite à charge égale : on conseille de maintenir / récupérer.
 * Un seul paramètre augmente à la fois.
 */

export interface SessionSets {
  date: string
  sets: SetLog[]
}

export interface Suggestion {
  loadKg?: number
  targetReps: number[]
  targetDurationSec?: number
  kind: 'first_time' | 'add_reps' | 'add_load' | 'hold' | 'harder_variant' | 'add_time'
  message: string
}

export interface ProgressionParams {
  exercise: Exercise
  reps?: [number, number]
  durationSec?: number
  sets: number
  /** Historique, de la séance la plus récente à la plus ancienne. */
  history: SessionSets[]
  incrementKg: number
}

const round = (n: number, step = 0.5) => Math.round(n / step) * step

export function suggestNext(p: ProgressionParams): Suggestion {
  const [min, max] = p.reps ?? [0, 0]
  const last = p.history[0]

  if (p.exercise.tracking === 'time' || (p.durationSec && !p.reps)) {
    const base = p.durationSec ?? 30
    if (!last || !last.sets.length) {
      return { kind: 'first_time', targetReps: [], targetDurationSec: base, message: `Tiens ${base} s par série.` }
    }
    const best = Math.max(...last.sets.map((s) => s.durationSec ?? 0))
    const next = Math.min(best + 5, base * 2)
    return { kind: 'add_time', targetReps: [], targetDurationSec: next, message: `Vise ${next} s (+5 s par rapport à la dernière fois).` }
  }

  if (!last || !last.sets.length) {
    return {
      kind: 'first_time',
      targetReps: Array(p.sets).fill(min),
      message:
        p.exercise.tracking === 'load'
          ? `Première fois : choisis une charge que tu peux soulever ${min + 2} fois proprement, puis arrête-toi à ${min} répétitions (2 en réserve).`
          : `Première fois : fais ${min} à ${max} répétitions propres, en gardant 1 à 2 répétitions en réserve.`,
    }
  }

  const lastSets = [...last.sets].sort((a, b) => a.setIndex - b.setIndex)
  const load = lastSets[0]?.loadKg
  const allTop = lastSets.length >= p.sets && lastSets.every((s) => (s.reps ?? 0) >= max)
  const rirOk = lastSets.every((s) => s.rir === undefined || s.rir >= 1)

  // Baisse de performance deux séances de suite à charge identique ?
  if (p.history.length >= 3) {
    const tot = (h: SessionSets) => h.sets.reduce((a, s) => a + (s.reps ?? 0), 0)
    const [h0, h1, h2] = p.history
    const sameLoad = [h0, h1, h2].every((h) => h.sets[0]?.loadKg === load)
    if (sameLoad && tot(h0) < tot(h1) && tot(h1) < tot(h2)) {
      return {
        kind: 'hold', loadKg: load, targetReps: lastSets.map((s) => s.reps ?? min),
        message: 'Répétitions en baisse deux séances de suite : garde la même charge, vérifie ton sommeil et ta fatigue. Si ça continue, baisse légèrement la charge.',
      }
    }
  }

  if (allTop && rirOk) {
    if (p.exercise.tracking === 'load' && load !== undefined) {
      const next = round(load + p.incrementKg)
      const jump = load > 0 ? (next - load) / load : 0
      const jumpMsg = jump > 0.15
        ? ` Le saut fait +${Math.round(jump * 100)} % : c'est normal de repartir à ${min} répétitions, voire un peu moins sur la dernière série.`
        : ''
      return {
        kind: 'add_load', loadKg: next, targetReps: Array(p.sets).fill(min),
        message: `Objectif atteint : passe à ${next} kg et repars à ${min} répétitions.${jumpMsg}`,
      }
    }
    return {
      kind: 'harder_variant', targetReps: Array(p.sets).fill(min),
      message: `Haut de fourchette atteint : passe à une variante plus difficile (tempo lent, sac lesté, élastique plus dur ou angle plus difficile) et repars à ${min} répétitions.`,
    }
  }

  const target = Array.from({ length: p.sets }, (_, i) => {
    const prev = lastSets[i]?.reps ?? lastSets[lastSets.length - 1]?.reps ?? min
    return Math.min(max, Math.max(min, prev + 1))
  })
  return {
    kind: 'add_reps', loadKg: load, targetReps: target,
    message: !rirOk
      ? 'Dernière séance à l’échec : garde la même charge et vise une répétition de plus en gardant 1 répétition en réserve.'
      : `Même charge${load !== undefined ? ` (${load} kg)` : ''}, une répétition de plus par série quand c'est possible.`,
  }
}
