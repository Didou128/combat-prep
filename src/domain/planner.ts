import { TEMPLATES } from './templates'
import type { DayIndex, Environment, TemplateId } from './types'

/**
 * Générateur de semaine de préparation physique.
 *
 * Contraintes strictes :
 *  1. Pas de préparation le jour d'un combat.
 *  2. Pas de séance « jambes lourdes » (A, C) la veille d'un combat.
 *  3. Au moins 48 h (2 jours d'écart) entre deux séances jambes lourdes.
 *  4. Une séance de préparation maximum par jour.
 *  5. Pas de préparation le dimanche (réservé AMHE).
 * Préférences : pénalités dans un score, la semaine au score le plus bas est retenue.
 */

export interface CombatDay {
  day: DayIndex
  kind: 'amhe' | 'kickboxing' | 'other'
}

export interface FixedPrep {
  day: DayIndex
  templateId: TemplateId
}

export interface PlannerInput {
  combatDays: CombatDay[]
  /** Séances de préparation déjà fixées (manuelles / effectuées) à respecter. */
  fixed?: FixedPrep[]
  /** Séances à placer, par ordre de priorité (ex. ['A','B','C']). */
  toPlace: TemplateId[]
  gymSessionsPerWeek?: number
  /** Le dernier jour de combat de la semaine précédente (ex. dimanche AMHE) : -1 = dimanche précédent. */
  previousSundayCombat?: boolean
}

export interface PlacedPrep {
  day: DayIndex
  templateId: TemplateId
  environment: Environment
}

export interface PlannerResult {
  prep: PlacedPrep[]
  mobility: DayIndex[]
  dropped: TemplateId[]
  notes: string[]
  score: number
}

const isLegHeavy = (t: TemplateId) => TEMPLATES[t].legHeavy

export function hardViolations(
  assignment: { day: number; templateId: TemplateId }[],
  combatDays: CombatDay[],
): string[] {
  const combat = new Set<number>(combatDays.map((c) => c.day))
  const errs: string[] = []
  const usedDays = new Set<number>()
  for (const a of assignment) {
    if (combat.has(a.day)) errs.push(`Séance ${a.templateId} le même jour qu'un combat`)
    if (a.day === 6) errs.push(`Séance ${a.templateId} le dimanche`)
    if (usedDays.has(a.day)) errs.push(`Deux séances de préparation le même jour`)
    usedDays.add(a.day)
    if (isLegHeavy(a.templateId) && combat.has(a.day + 1)) {
      errs.push(`Séance ${a.templateId} (jambes) la veille d'un combat`)
    }
  }
  const legs = assignment.filter((a) => isLegHeavy(a.templateId)).map((a) => a.day).sort((x, y) => x - y)
  for (let i = 1; i < legs.length; i++) {
    if (legs[i] - legs[i - 1] < 2) errs.push('Deux séances jambes à moins de 48 h')
  }
  return errs
}

function softScore(
  assignment: { day: number; templateId: TemplateId }[],
  combatDays: CombatDay[],
  previousSundayCombat: boolean,
): { score: number; notes: string[] } {
  let score = 0
  const notes: string[] = []
  const combatKind = new Map<number, CombatDay['kind']>(combatDays.map((c) => [c.day, c.kind]))
  const busy = new Array(7).fill(false)
  combatDays.forEach((c) => (busy[c.day] = true))
  for (const a of assignment) {
    busy[a.day] = true
    const prevIsCombat = a.day === 0 ? previousSundayCombat : combatKind.has(a.day - 1)
    const prevIsLongAmhe = a.day === 0 ? previousSundayCombat : combatKind.get(a.day - 1) === 'amhe'
    if (isLegHeavy(a.templateId)) {
      if (prevIsLongAmhe) {
        score += 3
        notes.push(`Séance ${a.templateId} au lendemain des AMHE : écoute tes jambes, version allégée possible.`)
      } else if (prevIsCombat) {
        score += 1
      }
    }
    // Préparation la veille de l'AMHE (4 h) : à éviter même pour le haut du corps
    if (combatKind.get(a.day + 1) === 'amhe') score += 2
  }
  // Enchaînements : 3 jours d'activité consécutifs ou plus
  let run = 0
  for (let d = 0; d < 7; d++) {
    run = busy[d] ? run + 1 : 0
    if (run >= 3) score += 2
  }
  // Préparation sur deux jours consécutifs
  const days = assignment.map((a) => a.day).sort((x, y) => x - y)
  for (let i = 1; i < days.length; i++) if (days[i] - days[i - 1] === 1) score += 1
  return { score, notes }
}

function* permutations<T>(items: T[], k: number): Generator<T[]> {
  if (k === 0) {
    yield []
    return
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const p of permutations(rest, k - 1)) yield [items[i], ...p]
  }
}

function bestPlacement(input: PlannerInput, templates: TemplateId[]) {
  const fixed = input.fixed ?? []
  const fixedDays = new Set(fixed.map((f) => f.day))
  const freeDays = ([0, 1, 2, 3, 4, 5] as DayIndex[]).filter(
    (d) => !fixedDays.has(d) && !input.combatDays.some((c) => c.day === d),
  )
  let best: { days: DayIndex[]; score: number; notes: string[] } | null = null
  for (const days of permutations(freeDays, templates.length)) {
    const assignment = [
      ...fixed.map((f) => ({ day: f.day as number, templateId: f.templateId })),
      ...templates.map((t, i) => ({ day: days[i] as number, templateId: t })),
    ]
    if (hardViolations(assignment, input.combatDays).length) continue
    const { score, notes } = softScore(assignment, input.combatDays, input.previousSundayCombat ?? true)
    if (!best || score < best.score) best = { days, score, notes }
  }
  return best
}

export function generateWeekPlan(input: PlannerInput): PlannerResult {
  let templates = [...input.toPlace]
  const dropped: TemplateId[] = []
  let best = bestPlacement(input, templates)
  // Si impossible, on retire la séance la moins prioritaire (fin de liste), jamais d'entassement.
  while (!best && templates.length) {
    dropped.unshift(templates.pop()!)
    best = bestPlacement(input, templates)
  }
  const notes: string[] = []
  if (dropped.length) {
    notes.push(
      `Impossible de placer ${dropped.map((t) => TEMPLATES[t].short).join(', ')} en respectant la récupération avant les combats : séance(s) non programmée(s) cette semaine.`,
    )
  }
  const placedDays = best?.days ?? []
  const placed = templates.map((t, i) => ({ day: placedDays[i], templateId: t }))
  if (best) notes.push(...best.notes)

  // Environnement : salle en priorité pour A, puis C, puis B.
  const gymBudget = input.gymSessionsPerWeek ?? 0
  const priority: TemplateId[] = ['A', 'C', 'B']
  const sortedForGym = [...placed].sort((a, b) => priority.indexOf(a.templateId) - priority.indexOf(b.templateId))
  const gymSet = new Set(sortedForGym.slice(0, gymBudget).map((p) => p.templateId))
  const prep: PlacedPrep[] = placed
    .map((p) => ({ ...p, environment: (gymSet.has(p.templateId) ? 'gym' : 'home') as Environment }))
    .sort((a, b) => a.day - b.day)

  // Mobilité : samedi (veille AMHE) et lendemain d'un combat, sur jours sans préparation.
  const occupied = new Set<number>([...prep.map((p) => p.day), ...(input.fixed ?? []).map((f) => f.day)])
  const combat = new Set<number>(input.combatDays.map((c) => c.day))
  const mobility: DayIndex[] = []
  for (let d = 0; d < 6; d++) {
    if (occupied.has(d) || combat.has(d)) continue
    const afterCombat = d === 0 ? (input.previousSundayCombat ?? true) : combat.has(d - 1)
    const beforeAmhe = input.combatDays.some((c) => c.day === d + 1 && c.kind === 'amhe')
    if (afterCombat || beforeAmhe) mobility.push(d as DayIndex)
  }

  const satKick = input.combatDays.some((c) => c.day === 5 && c.kind === 'kickboxing')
  if (satKick && input.combatDays.some((c) => c.day === 6 && c.kind === 'amhe')) {
    notes.push('Kick-boxing samedi puis AMHE dimanche : deux combats d’affilée, garde un sparring léger.')
  }

  return { prep, mobility, dropped, notes: [...new Set(notes)], score: best?.score ?? Infinity }
}
