import { addDays, dayIndex, timeToMinutes } from './dates'
import { TEMPLATES } from './templates'
import type { PlannedSession } from './types'

export interface Warning {
  level: 'error' | 'warning' | 'info'
  sessionIds: string[]
  date: string
  message: string
}

const isCombat = (s: PlannedSession) => s.kind === 'amhe' || s.kind === 'kickboxing'
const isPrep = (s: PlannedSession) => s.kind === 'prep'
const isLegHeavy = (s: PlannedSession) => s.kind === 'prep' && !!s.templateId && TEMPLATES[s.templateId].legHeavy
const label = (s: PlannedSession) =>
  s.kind === 'amhe' ? 'AMHE' : s.kind === 'kickboxing' ? 'Kick-boxing' : s.templateId ? TEMPLATES[s.templateId].short : s.title ?? 'Séance'

/**
 * Analyse une liste de séances (idéalement la semaine + les jours voisins)
 * et renvoie les conflits et enchaînements trop fatigants.
 * Les séances annulées sont ignorées. Rien n'est bloqué : ce sont des avertissements.
 */
export function analyzeSessions(all: PlannedSession[]): Warning[] {
  const sessions = all.filter((s) => s.status !== 'cancelled')
  const byDate = new Map<string, PlannedSession[]>()
  for (const s of sessions) {
    if (!byDate.has(s.date)) byDate.set(s.date, [])
    byDate.get(s.date)!.push(s)
  }
  const warnings: Warning[] = []

  for (const [date, list] of byDate) {
    // Chevauchement horaire
    const sorted = [...list].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], b = sorted[j]
        if (timeToMinutes(a.startTime) + a.durationMin > timeToMinutes(b.startTime)) {
          warnings.push({ level: 'error', sessionIds: [a.id, b.id], date, message: `${label(a)} et ${label(b)} se chevauchent.` })
        }
      }
    }
    const preps = list.filter(isPrep)
    if (preps.length > 1) {
      warnings.push({ level: 'warning', sessionIds: preps.map((p) => p.id), date, message: 'Deux séances de préparation physique le même jour.' })
    }
    const combats = list.filter(isCombat)
    if (combats.length && preps.length) {
      warnings.push({
        level: 'warning', sessionIds: [...combats, ...preps].map((s) => s.id), date,
        message: `Préparation physique (${preps.map(label).join(', ')}) le même jour que ${combats.map(label).join(', ')}.`,
      })
    }
    if (dayIndex(date) === 6) {
      for (const s of list.filter((x) => x.kind !== 'amhe' && x.kind !== 'mobility')) {
        warnings.push({ level: 'info', sessionIds: [s.id], date, message: `Le dimanche est réservé aux AMHE : ${label(s)} y a été placé manuellement.` })
      }
    }
    // Veille de combat
    const tomorrow = (byDate.get(addDays(date, 1)) ?? []).filter(isCombat)
    if (tomorrow.length) {
      for (const s of list.filter(isLegHeavy)) {
        warnings.push({
          level: 'warning', sessionIds: [s.id, ...tomorrow.map((t) => t.id)], date,
          message: `${label(s)} sollicite fortement les jambes la veille de ${tomorrow.map(label).join(', ')}.`,
        })
      }
      if (combats.length) {
        warnings.push({
          level: 'info', sessionIds: [...combats, ...tomorrow].map((s) => s.id), date,
          message: `Deux jours de combat d’affilée (${combats.map(label).join(', ')} puis ${tomorrow.map(label).join(', ')}).`,
        })
      }
    }
    // 48 h entre séances jambes lourdes
    const legsToday = list.filter(isLegHeavy)
    const legsTomorrow = (byDate.get(addDays(date, 1)) ?? []).filter(isLegHeavy)
    if (legsToday.length && legsTomorrow.length) {
      warnings.push({
        level: 'warning', sessionIds: [...legsToday, ...legsTomorrow].map((s) => s.id), date,
        message: 'Deux séances sollicitant les jambes à moins de 48 h d’intervalle.',
      })
    }
  }
  return warnings
}
