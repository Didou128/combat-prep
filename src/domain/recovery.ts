import { addDays } from './dates'
import type { RecoveryCheckin } from './types'

/**
 * Évaluation de la récupération à partir du point du jour.
 * Les résultats sont INDICATIFS : simples règles de bon sens, pas un avis médical.
 *
 * Score 0–100 (100 = parfaitement récupéré), pondéré :
 * sommeil (durée 20 %, qualité 15 %), énergie 20 %, fatigue 20 %, courbatures 15 %, motivation 10 %.
 * Signaux d'alerte (sommeil < 5 h, fatigue 5/5, courbatures 5/5) : un seul plafonne le niveau à « moyen »,
 * deux ou plus le passent à « bas ».
 */

export type RecoveryLevel = 'bon' | 'moyen' | 'bas'

export interface RecoveryAssessment {
  score: number
  level: RecoveryLevel
  /** Ce qui tire le score vers le bas, pour expliquer le niveau. */
  reasons: string[]
  suggestions: string[]
  /** Au moins 3 jours d'affilée sans bonne récupération. */
  persistent: boolean
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const scale5 = (v: number) => clamp01((v - 1) / 4)

export function recoveryScore(c: RecoveryCheckin): number {
  const parts = [
    [clamp01((c.sleepHours - 5) / 3), 0.2], // 5 h → 0, 8 h et plus → 1
    [scale5(c.sleepQuality), 0.15],
    [scale5(c.energy), 0.2],
    [1 - scale5(c.fatigue), 0.2],
    [1 - scale5(c.soreness), 0.15],
    [scale5(c.motivation), 0.1],
  ] as const
  return Math.round(100 * parts.reduce((a, [v, w]) => a + v * w, 0))
}

function baseLevel(c: RecoveryCheckin): { level: RecoveryLevel; flags: string[] } {
  const score = recoveryScore(c)
  let level: RecoveryLevel = score >= 65 ? 'bon' : score >= 45 ? 'moyen' : 'bas'
  const flags: string[] = []
  if (c.sleepHours < 5) flags.push(`sommeil très court (${c.sleepHours} h)`)
  if (c.fatigue >= 5) flags.push('fatigue maximale')
  if (c.soreness >= 5) flags.push('courbatures très fortes')
  if (flags.length >= 2) level = 'bas'
  else if (flags.length === 1 && level === 'bon') level = 'moyen'
  return { level, flags }
}

/**
 * @param previous points des jours précédents (n'importe quel ordre) : sert à détecter une fatigue qui dure.
 */
export function assessRecovery(c: RecoveryCheckin, previous: RecoveryCheckin[] = []): RecoveryAssessment {
  const score = recoveryScore(c)
  const { level, flags } = baseLevel(c)
  const reasons = [...flags]
  if (c.sleepHours >= 5 && c.sleepHours < 6.5) reasons.push(`sommeil court (${c.sleepHours} h)`)
  if (c.sleepQuality <= 2) reasons.push('sommeil de mauvaise qualité')
  if (c.energy <= 2) reasons.push('énergie basse')
  if (c.fatigue === 4) reasons.push('fatigue élevée')
  if (c.soreness === 4) reasons.push('courbatures marquées')
  if (c.motivation <= 2) reasons.push('motivation basse')

  const byDate = new Map(previous.map((p) => [p.date, p]))
  const d1 = byDate.get(addDays(c.date, -1))
  const d2 = byDate.get(addDays(c.date, -2))
  const persistent = level !== 'bon' && !!d1 && !!d2 && baseLevel(d1).level !== 'bon' && baseLevel(d2).level !== 'bon'

  const suggestions: string[] = []
  if (level === 'bon') {
    suggestions.push('Feu vert : la séance prévue peut se faire normalement.')
  } else if (level === 'moyen') {
    suggestions.push('Tu peux garder la séance prévue, en restant prudent : 2 à 3 répétitions en réserve et pas de nouvelle charge aujourd’hui.')
  } else {
    suggestions.push('Préfère la version allégée de la séance, ou remplace-la par la mobilité de 15 minutes.')
    suggestions.push('Si un combat est prévu, garde un sparring léger.')
  }
  if (c.soreness >= 4) {
    suggestions.push('Courbatures : allonge l’échauffement ; la mobilité de 15 minutes peut aider.')
    suggestions.push('Une douleur vive, articulaire ou qui dure n’est pas une courbature : ne charge pas la zone et demande l’avis d’un professionnel de santé.')
  }
  if (c.sleepHours < 6.5 || c.sleepQuality <= 2) {
    suggestions.push('Sommeil insuffisant : vise une nuit plus longue ce soir, c’est là que se construit la masse musculaire.')
  }
  if (c.motivation <= 2 && level !== 'bas') {
    suggestions.push('Motivation basse mais corps plutôt reposé : commence l’échauffement, puis décide si tu continues.')
  }
  if (persistent) {
    suggestions.push('Récupération insuffisante 3 jours de suite : envisage une semaine plus légère (une séance de moins, charges stables).')
  }
  return { score, level, reasons, suggestions, persistent }
}

export function validateCheckin(c: RecoveryCheckin): string[] {
  const errs: string[] = []
  if (!Number.isFinite(c.sleepHours) || c.sleepHours < 0 || c.sleepHours > 16) errs.push('Durée de sommeil entre 0 et 16 h.')
  for (const v of [c.sleepQuality, c.energy, c.fatigue, c.soreness, c.motivation]) {
    if (!Number.isInteger(v) || v < 1 || v > 5) {
      errs.push('Les notes vont de 1 à 5.')
      break
    }
  }
  return errs
}

export const LEVEL_LABELS: Record<RecoveryLevel, string> = {
  bon: 'Bonne récupération',
  moyen: 'Récupération moyenne',
  bas: 'Récupération insuffisante',
}
