import { addDays, dayIndex, weekStartOf } from './dates'
import { hardViolations, softScore, type CombatDay } from './planner'
import { TEMPLATES } from './templates'
import type { PlannedSession, TemplateId } from './types'

/**
 * Réorganisation après une séance de préparation manquée.
 *
 * Principe « sans accumulation » :
 *  - on ne rattrape que dans la MÊME semaine, sur un jour encore à venir (aujourd'hui compris) ;
 *  - jamais deux séances de préparation le même jour, et toutes les règles du planificateur
 *    restent strictes (veille de combat, 48 h entre séances jambes, dimanche libre) ;
 *  - s'il n'y a pas de place, on peut remplacer une séance moins prioritaire (A > C > B)
 *    ou abandonner la séance manquée. On ne reporte jamais à la semaine suivante.
 */

export const PRIORITY: TemplateId[] = ['A', 'C', 'B']

export type RescheduleOption =
  | { kind: 'move'; date: string; recommended: boolean; note?: string }
  | { kind: 'replace'; targetId: string; targetTemplateId: TemplateId; date: string }
  | { kind: 'skip' }

const isCombat = (s: PlannedSession) => s.kind === 'amhe' || s.kind === 'kickboxing'
const active = (s: PlannedSession) => s.status !== 'cancelled'

/** Séances de préparation dont la date est passée et qui sont toujours « prévues ». */
export function findMissed(sessions: PlannedSession[], today: string): PlannedSession[] {
  return sessions
    .filter((s) => s.kind === 'prep' && s.status === 'planned' && s.date < today && !!s.templateId)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

/**
 * @param week toutes les séances de la semaine de la séance manquée (le dimanche précédent peut être inclus).
 */
export function proposeReschedule(missed: PlannedSession, week: PlannedSession[], today: string): RescheduleOption[] {
  const tpl = missed.templateId
  if (!tpl) return [{ kind: 'skip' }]
  const weekStart = weekStartOf(missed.date)
  const saturday = addDays(weekStart, 5)
  const inWeek = week.filter((s) => s.date >= weekStart && s.date <= addDays(weekStart, 6) && active(s))
  const combatDays: CombatDay[] = inWeek.filter(isCombat).map((s) => ({ day: dayIndex(s.date), kind: s.kind as 'amhe' | 'kickboxing' }))
  const prevSundayCombat = week.some((s) => s.date === addDays(weekStart, -1) && s.kind === 'amhe' && active(s))
  const otherPrep = inWeek.filter((s) => s.kind === 'prep' && s.id !== missed.id && s.templateId)
  const assignment = (list: { date: string; templateId: TemplateId }[]) =>
    list.map((p) => ({ day: dayIndex(p.date) as number, templateId: p.templateId }))

  const options: RescheduleOption[] = []

  // 1. Déplacer sur un jour libre et sûr de la même semaine.
  const moves: { date: string; score: number }[] = []
  for (let d = today > weekStart ? today : weekStart; d <= saturday; d = addDays(d, 1)) {
    const a = assignment([...otherPrep.map((p) => ({ date: p.date, templateId: p.templateId! })), { date: d, templateId: tpl }])
    if (hardViolations(a, combatDays).length) continue
    moves.push({ date: d, score: softScore(a, combatDays, prevSundayCombat).score })
  }
  moves.sort((x, y) => x.score - y.score || (x.date < y.date ? -1 : 1))
  moves.forEach((m, i) => {
    const beforeAmhe = combatDays.some((c) => c.kind === 'amhe' && c.day === dayIndex(m.date) + 1)
    options.push({
      kind: 'move', date: m.date, recommended: i === 0,
      note: beforeAmhe ? 'Veille des AMHE : garde des charges modérées.' : undefined,
    })
  })

  // 2. Pas de place : remplacer une séance encore prévue et moins prioritaire.
  if (!moves.length) {
    for (const target of otherPrep) {
      if (target.status !== 'planned' || target.date < today) continue
      if (PRIORITY.indexOf(target.templateId!) <= PRIORITY.indexOf(tpl)) continue
      const a = assignment([
        ...otherPrep.filter((p) => p.id !== target.id).map((p) => ({ date: p.date, templateId: p.templateId! })),
        { date: target.date, templateId: tpl },
      ])
      if (hardViolations(a, combatDays).length) continue
      options.push({ kind: 'replace', targetId: target.id, targetTemplateId: target.templateId!, date: target.date })
    }
  }

  // 3. Toujours possible : ne pas rattraper.
  options.push({ kind: 'skip' })
  return options
}

export function describeOption(o: RescheduleOption, missedTemplate: TemplateId, formatDate: (d: string) => string): string {
  switch (o.kind) {
    case 'move': return `Déplacer à ${formatDate(o.date)}${o.note ? ` — ${o.note}` : ''}`
    case 'replace':
      return `Faire ${TEMPLATES[missedTemplate].short} à la place de ${TEMPLATES[o.targetTemplateId].short} (${formatDate(o.date)}), plus prioritaire pour la force`
    case 'skip': return 'Ne pas rattraper : la semaine continue normalement'
  }
}
