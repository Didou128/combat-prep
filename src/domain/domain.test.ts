import { describe, expect, it } from 'vitest'
import { addDays, dayIndex, weekStartOf, isValidISODate } from './dates'
import { EXERCISES, getExercise, resolveExercise } from './exercises'
import { generateWeekPlan, hardViolations, type CombatDay } from './planner'
import { analyzeSessions } from './conflicts'
import { suggestNext } from './progression'
import { buildSession, TEMPLATES } from './templates'
import type { DayIndex, EquipmentId, PlannedSession, SetLog } from './types'

const combatWeek = (kickDay: DayIndex): CombatDay[] => [
  { day: kickDay, kind: 'kickboxing' },
  { day: 6, kind: 'amhe' },
]

describe('dates', () => {
  it('calcule le lundi de la semaine et l’index du jour', () => {
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26') // dimanche -> lundi précédent
    expect(dayIndex('2026-10-26')).toBe(0)
    expect(dayIndex('2026-11-01')).toBe(6)
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26') // passage à l'heure d'hiver
    expect(isValidISODate('2026-02-30')).toBe(false)
  })
})

describe('générateur de semaine', () => {
  for (const kick of [0, 1, 2, 3, 4, 5] as DayIndex[]) {
    it(`kick-boxing jour ${kick} : respecte toutes les contraintes strictes`, () => {
      const res = generateWeekPlan({ combatDays: combatWeek(kick), toPlace: ['A', 'B', 'C'], gymSessionsPerWeek: 2 })
      expect(res.prep).toHaveLength(3)
      expect(res.dropped).toEqual([])
      expect(hardViolations(res.prep, combatWeek(kick))).toEqual([])
      // Jamais le dimanche, jamais le samedi pour les séances jambes
      expect(res.prep.some((p) => p.day === 6)).toBe(false)
      expect(res.prep.some((p) => p.day === 5 && TEMPLATES[p.templateId].legHeavy)).toBe(false)
      // Jamais le jour du kick
      expect(res.prep.some((p) => p.day === kick)).toBe(false)
      // La séance A est en salle quand il y a 2 séances salle
      expect(res.prep.find((p) => p.templateId === 'A')?.environment).toBe('gym')
      expect(res.prep.filter((p) => p.environment === 'gym')).toHaveLength(2)
    })
  }

  it('kick le mardi : B lundi, A mercredi, C vendredi', () => {
    const res = generateWeekPlan({ combatDays: combatWeek(1), toPlace: ['A', 'B', 'C'] })
    const map = Object.fromEntries(res.prep.map((p) => [p.templateId, p.day]))
    expect(map).toEqual({ B: 0, A: 2, C: 4 })
  })

  it('kick le mercredi : les jambes lundi et vendredi, B jamais le samedi', () => {
    const res = generateWeekPlan({ combatDays: combatWeek(2), toPlace: ['A', 'B', 'C'] })
    const legs = res.prep.filter((p) => TEMPLATES[p.templateId].legHeavy).map((p) => p.day).sort()
    expect(legs).toEqual([0, 4])
    expect(res.prep.find((p) => p.templateId === 'B')?.day).not.toBe(5)
    expect(res.notes.some((n) => n.includes('lendemain des AMHE'))).toBe(true)
  })

  it('retire une séance plutôt que d’entasser si la semaine est trop chargée', () => {
    // Combats lundi, mercredi, vendredi et dimanche : il n'y a plus de place pour deux séances jambes espacées.
    const combat: CombatDay[] = [
      { day: 0, kind: 'other' }, { day: 2, kind: 'kickboxing' }, { day: 4, kind: 'other' }, { day: 6, kind: 'amhe' },
    ]
    const res = generateWeekPlan({ combatDays: combat, toPlace: ['A', 'B', 'C'] })
    expect(res.dropped.length).toBeGreaterThan(0)
    expect(hardViolations(res.prep, combat)).toEqual([])
    expect(res.notes[0]).toMatch(/Impossible/)
  })

  it('respecte une séance déjà fixée manuellement', () => {
    const res = generateWeekPlan({ combatDays: combatWeek(2), fixed: [{ day: 3, templateId: 'B' }], toPlace: ['A', 'C'] })
    expect(hardViolations([...res.prep, { day: 3, templateId: 'B' }], combatWeek(2))).toEqual([])
    expect(res.prep.some((p) => p.day === 3)).toBe(false)
  })

  it('propose de la mobilité le samedi (veille AMHE)', () => {
    const res = generateWeekPlan({ combatDays: combatWeek(1), toPlace: ['A', 'B', 'C'] })
    expect(res.mobility).toContain(5)
  })
})

const mk = (p: Partial<PlannedSession>): PlannedSession => ({
  id: Math.random().toString(36).slice(2), date: '2026-10-26', startTime: '18:00', durationMin: 60, kind: 'prep',
  status: 'planned', source: 'manual', createdAt: '', updatedAt: '', ...p,
})

describe('détection des conflits', () => {
  it('signale une séance jambes la veille du kick-boxing', () => {
    const w = analyzeSessions([
      mk({ date: '2026-10-27', templateId: 'A' }),
      mk({ date: '2026-10-28', kind: 'kickboxing', startTime: '19:00' }),
    ])
    expect(w.some((x) => x.message.includes('veille'))).toBe(true)
  })
  it('signale un chevauchement horaire', () => {
    const w = analyzeSessions([
      mk({ date: '2026-10-27', templateId: 'B', startTime: '18:00', durationMin: 60 }),
      mk({ date: '2026-10-27', kind: 'kickboxing', startTime: '18:30' }),
    ])
    expect(w.some((x) => x.level === 'error')).toBe(true)
  })
  it('ignore les séances annulées', () => {
    const w = analyzeSessions([
      mk({ date: '2026-10-27', templateId: 'A', status: 'cancelled' }),
      mk({ date: '2026-10-28', kind: 'kickboxing' }),
    ])
    expect(w).toEqual([])
  })
  it('signale deux séances jambes à moins de 48 h', () => {
    const w = analyzeSessions([mk({ date: '2026-10-26', templateId: 'A' }), mk({ date: '2026-10-27', templateId: 'C' })])
    expect(w.some((x) => x.message.includes('48 h'))).toBe(true)
  })
  it('B la veille du kick ne déclenche pas d’avertissement jambes', () => {
    const w = analyzeSessions([mk({ date: '2026-10-27', templateId: 'B' }), mk({ date: '2026-10-28', kind: 'kickboxing' })])
    expect(w).toEqual([])
  })
})

describe('bibliothèque et variantes salle / domicile', () => {
  const home: EquipmentId[] = ['bands', 'parallettes', 'pullupBar', 'rings']
  it('tous les remplaçants référencés existent', () => {
    for (const e of EXERCISES) for (const s of e.substitutes) expect(() => getExercise(s)).not.toThrow()
    for (const t of Object.values(TEMPLATES)) for (const s of t.slots) { getExercise(s.gym); getExercise(s.home) }
  })
  it('remplace le squat avec sac par le squat élastique si pas de sac', () => {
    expect(resolveExercise('squat-sac', home)?.id).toBe('squat-elastique')
    expect(resolveExercise('squat-sac', [...home, 'backpack'])?.id).toBe('squat-sac')
  })
  it('chaque séance A/B/C est réalisable à domicile avec le matériel de Dylan', () => {
    for (const id of ['A', 'B', 'C'] as const) {
      const slots = buildSession(id, 'home', home)
      expect(slots.length).toBe(TEMPLATES[id].slots.length)
      for (const s of slots) expect(s.exercise.equipment.every((e) => home.includes(e))).toBe(true)
    }
  })
  it('la version allégée retire l’explosivité et une série', () => {
    const normal = buildSession('C', 'gym', ['dumbbells', 'medball', 'cable', 'barbell', 'bench'])
    const light = buildSession('C', 'gym', ['dumbbells', 'medball', 'cable', 'barbell', 'bench'], true)
    expect(light.some((s) => s.exercise.category === 'explosivite')).toBe(false)
    expect(light[0].sets).toBe(normal.find((s) => s.exercise.id === light[0].exercise.id)!.sets - 1)
  })
})

describe('double progression', () => {
  const curl = getExercise('curl-halteres')
  const sets = (reps: number[], load: number, rir?: number): SetLog[] =>
    reps.map((r, i) => ({ id: String(i), workoutLogId: 'w', exerciseId: curl.id, setIndex: i, reps: r, loadKg: load, rir, loggedAt: '' }))

  it('ajoute des répétitions tant que le haut de fourchette n’est pas atteint', () => {
    const s = suggestNext({ exercise: curl, reps: [8, 12], sets: 3, incrementKg: 2, history: [{ date: 'd', sets: sets([8, 7, 6], 8, 2) }] })
    expect(s.kind).toBe('add_reps')
    expect(s.loadKg).toBe(8)
    expect(s.targetReps).toEqual([9, 8, 8])
  })
  it('augmente la charge quand toutes les séries sont en haut de fourchette avec RIR ≥ 1', () => {
    const s = suggestNext({ exercise: curl, reps: [8, 12], sets: 3, incrementKg: 2, history: [{ date: 'd', sets: sets([12, 12, 12], 8, 1) }] })
    expect(s.kind).toBe('add_load')
    expect(s.loadKg).toBe(10)
    expect(s.targetReps).toEqual([8, 8, 8])
    expect(s.message).toMatch(/\+25 %/)
  })
  it('n’augmente pas la charge si la dernière séance était à l’échec', () => {
    const s = suggestNext({ exercise: curl, reps: [8, 12], sets: 3, incrementKg: 2, history: [{ date: 'd', sets: sets([12, 12, 12], 8, 0) }] })
    expect(s.kind).toBe('add_reps')
  })
  it('conseille de maintenir si les répétitions baissent deux fois de suite', () => {
    const s = suggestNext({
      exercise: curl, reps: [8, 12], sets: 3, incrementKg: 2,
      history: [{ date: '3', sets: sets([8, 7, 6], 8) }, { date: '2', sets: sets([9, 8, 8], 8) }, { date: '1', sets: sets([10, 9, 9], 8) }],
    })
    expect(s.kind).toBe('hold')
  })
  it('première fois : consigne de choix de charge', () => {
    expect(suggestNext({ exercise: curl, reps: [8, 12], sets: 3, incrementKg: 2, history: [] }).kind).toBe('first_time')
  })
})
