import { describe, expect, it } from 'vitest'
import { assessRecovery, recoveryScore, validateCheckin } from './recovery'
import { exercisesWithLoad, lastWeeks, loadProgress, weeklyAdherence, weeklyVolume } from './stats'
import { findMissed, proposeReschedule } from './reschedule'
import { hardViolations } from './planner'
import { buildSession, estimateDurationSec, TEMPLATES } from './templates'
import { dayIndex } from './dates'
import type { PlannedSession, RecoveryCheckin, SetLog } from './types'

// ---------- Récupération ----------

const ck = (p: Partial<RecoveryCheckin> = {}): RecoveryCheckin => ({
  date: '2026-10-29', sleepHours: 8, sleepQuality: 4, energy: 4, fatigue: 2, soreness: 2, motivation: 4, updatedAt: '', ...p,
})

describe('suivi de la récupération', () => {
  it('bonne nuit et bonnes sensations : niveau bon, feu vert', () => {
    const a = assessRecovery(ck())
    expect(a.level).toBe('bon')
    expect(a.score).toBeGreaterThanOrEqual(65)
    expect(a.suggestions[0]).toMatch(/Feu vert/)
  })

  it('les scores extrêmes valent 0 et 100', () => {
    expect(recoveryScore(ck({ sleepHours: 9, sleepQuality: 5, energy: 5, fatigue: 1, soreness: 1, motivation: 5 }))).toBe(100)
    expect(recoveryScore(ck({ sleepHours: 4, sleepQuality: 1, energy: 1, fatigue: 5, soreness: 5, motivation: 1 }))).toBe(0)
  })

  it('un seul signal d’alerte plafonne à « moyen » même si le reste va bien', () => {
    const a = assessRecovery(ck({ sleepHours: 4.5, sleepQuality: 5, energy: 5, fatigue: 1, soreness: 1, motivation: 5 }))
    expect(a.level).toBe('moyen')
    expect(a.reasons.join()).toMatch(/sommeil très court/)
  })

  it('deux signaux d’alerte : niveau bas et proposition d’alléger', () => {
    const a = assessRecovery(ck({ fatigue: 5, soreness: 5 }))
    expect(a.level).toBe('bas')
    expect(a.suggestions.join(' ')).toMatch(/allégée/)
    expect(a.suggestions.join(' ')).toMatch(/professionnel de santé/)
  })

  it('détecte une récupération insuffisante trois jours d’affilée', () => {
    const tired = { sleepHours: 5.5, sleepQuality: 2, energy: 2, fatigue: 4, soreness: 3, motivation: 3 }
    const prev = [ck({ ...tired, date: '2026-10-27' }), ck({ ...tired, date: '2026-10-28' })]
    const a = assessRecovery(ck({ ...tired }), prev)
    expect(a.persistent).toBe(true)
    expect(a.suggestions.join(' ')).toMatch(/semaine plus légère/)
    // Un jour manquant dans la série : pas de conclusion hâtive
    expect(assessRecovery(ck({ ...tired }), [prev[0]]).persistent).toBe(false)
  })

  it('valide les saisies', () => {
    expect(validateCheckin(ck())).toEqual([])
    expect(validateCheckin(ck({ energy: 6 }))).not.toEqual([])
    expect(validateCheckin(ck({ sleepHours: -1 }))).not.toEqual([])
  })
})

// ---------- Statistiques ----------

let sid = 0
const set = (p: Partial<SetLog>): SetLog => ({
  id: String(sid++), workoutLogId: 'w1', exerciseId: 'curl-halteres', setIndex: 0, loggedAt: '2026-10-20T17:00:00', ...p,
})
const ses = (p: Partial<PlannedSession>): PlannedSession => ({
  id: String(sid++), date: '2026-10-20', startTime: '18:00', durationMin: 60, kind: 'prep', templateId: 'B',
  status: 'planned', source: 'generated', createdAt: '', updatedAt: '', ...p,
})

describe('statistiques de progression', () => {
  const sets: SetLog[] = [
    set({ workoutLogId: 'w1', reps: 15, loadKg: 6, loggedAt: '2026-10-13T18:00:00' }),
    set({ workoutLogId: 'w1', reps: 12, loadKg: 6, loggedAt: '2026-10-13T18:05:00' }),
    set({ workoutLogId: 'w2', reps: 10, loadKg: 8, loggedAt: '2026-10-20T18:00:00' }),
    set({ workoutLogId: 'w2', reps: 8, loadKg: 8, loggedAt: '2026-10-20T18:05:00' }),
    set({ workoutLogId: 'w2', exerciseId: 'pompes', reps: 12, loggedAt: '2026-10-20T18:10:00' }),
    set({ workoutLogId: 'w2', exerciseId: 'mob-90-90', durationSec: 60, loggedAt: '2026-10-20T18:20:00' }),
  ]

  it('meilleure charge par séance, dans l’ordre chronologique', () => {
    const p = loadProgress('curl-halteres', sets)
    expect(p.map((x) => [x.date, x.bestLoadKg, x.repsAtBest])).toEqual([['2026-10-13', 6, 15], ['2026-10-20', 8, 10]])
    expect(p[0].e1rmKg).toBeUndefined() // 15 répétitions : estimation non fiable, non affichée
    expect(p[1].e1rmKg).toBe(10.7) // 8 × (1 + 10/30)
  })

  it('ne liste que les exercices réellement chargés', () => {
    expect(exercisesWithLoad(sets).map((e) => e.id)).toEqual(['curl-halteres'])
  })

  it('volume hebdomadaire : séries hors mobilité et tonnage, semaines vides à zéro', () => {
    const weeks = ['2026-10-12', '2026-10-19', '2026-10-26']
    expect(weeklyVolume(sets, weeks)).toEqual([
      { weekStart: '2026-10-12', workSets: 2, tonnageKg: 162 },
      { weekStart: '2026-10-19', workSets: 3, tonnageKg: 144 },
      { weekStart: '2026-10-26', workSets: 0, tonnageKg: 0 },
    ])
  })

  it('assiduité : faites, partielles, manquées ; le futur et le jour même non renseigné ne comptent pas', () => {
    const sessions = [
      ses({ date: '2026-10-26', status: 'done' }),
      ses({ date: '2026-10-27', status: 'partial' }),
      ses({ date: '2026-10-28', status: 'planned' }), // passée, jamais faite → manquée
      ses({ date: '2026-10-29', status: 'planned' }), // aujourd'hui, pas encore faite → pas due
      ses({ date: '2026-10-31', status: 'planned' }), // future
      ses({ date: '2026-10-28', kind: 'kickboxing', templateId: undefined, status: 'done' }),
    ]
    expect(weeklyAdherence(sessions, ['2026-10-26'], '2026-10-29')).toEqual([
      { weekStart: '2026-10-26', due: 3, done: 1, partial: 1, missed: 1, combatDone: 1 },
    ])
  })

  it('liste des dernières semaines', () => {
    expect(lastWeeks(3, '2026-10-29')).toEqual(['2026-10-12', '2026-10-19', '2026-10-26'])
  })
})

// ---------- Séance manquée ----------

describe('réorganisation après une séance manquée', () => {
  // Semaine du 26 oct. : kick mercredi 28, AMHE dimanche 1er nov.
  const week = (extra: PlannedSession[] = []) => [
    ses({ id: 'kick', date: '2026-10-28', kind: 'kickboxing', templateId: undefined }),
    ses({ id: 'amhe', date: '2026-11-01', kind: 'amhe', templateId: undefined }),
    ...extra,
  ]
  const check = (all: PlannedSession[], moved: { id: string; date: string }) => {
    const prep = all.filter((s) => s.kind === 'prep' && s.status !== 'cancelled').map((s) => (s.id === moved.id ? { ...s, date: moved.date } : s))
    const combat = all.filter((s) => s.kind !== 'prep').map((s) => ({ day: dayIndex(s.date), kind: s.kind as 'amhe' }))
    return hardViolations(prep.map((p) => ({ day: dayIndex(p.date), templateId: p.templateId! })), combat)
  }

  it('repère les séances passées encore « prévues »', () => {
    const all = week([ses({ id: 'a', date: '2026-10-26', templateId: 'A' }), ses({ id: 'b', date: '2026-10-30' })])
    expect(findMissed(all, '2026-10-29').map((s) => s.id)).toEqual(['a'])
  })

  it('propose un jour sûr de la même semaine, sans doubler une journée', () => {
    // A manquée lundi ; B prévue jeudi 29. Aujourd'hui jeudi.
    const all = week([ses({ id: 'a', date: '2026-10-26', templateId: 'A' }), ses({ id: 'b', date: '2026-10-29', templateId: 'B' })])
    const opts = proposeReschedule(all[2], all, '2026-10-29')
    const moves = opts.filter((o) => o.kind === 'move')
    expect(moves.length).toBeGreaterThan(0)
    for (const m of moves) {
      expect(m.date >= '2026-10-29' && m.date <= '2026-10-31').toBe(true)
      expect(m.date).not.toBe('2026-10-29') // jour déjà occupé par B
      expect(check(all, { id: 'a', date: m.date })).toEqual([])
    }
    expect(opts.at(-1)?.kind).toBe('skip')
  })

  it('séance jambes : jamais la veille d’un combat ni à moins de 48 h d’une autre', () => {
    // C manquée lundi ; A prévue vendredi 30 → samedi interdit (veille AMHE), jeudi interdit (48 h avec A).
    const all = week([ses({ id: 'c', date: '2026-10-26', templateId: 'C' }), ses({ id: 'a', date: '2026-10-30', templateId: 'A' })])
    const opts = proposeReschedule(all[2], all, '2026-10-29')
    expect(opts.filter((o) => o.kind === 'move')).toEqual([])
  })

  it('sans place : propose de remplacer une séance moins prioritaire', () => {
    // A manquée lundi ; B prévue vendredi 30 ; C prévue jeudi 29 (déjà faite). Aujourd'hui vendredi.
    const all = week([
      ses({ id: 'a', date: '2026-10-26', templateId: 'A' }),
      ses({ id: 'c', date: '2026-10-29', templateId: 'C', status: 'done' }),
      ses({ id: 'b', date: '2026-10-30', templateId: 'B' }),
    ])
    const opts = proposeReschedule(all[2], all, '2026-10-30')
    // Samedi impossible (veille AMHE), vendredi déjà pris par B ; A à la place de B ? A vendredi = 24 h après C → interdit.
    expect(opts.filter((o) => o.kind !== 'skip')).toEqual([])

    const all2 = week([
      ses({ id: 'a', date: '2026-10-26', templateId: 'A' }),
      ses({ id: 'b', date: '2026-10-30', templateId: 'B' }),
    ])
    // Samedi interdit pour A, vendredi pris par B → remplacer B par A le vendredi.
    const opts2 = proposeReschedule(all2[2], all2, '2026-10-30')
    expect(opts2[0]).toEqual({ kind: 'replace', targetId: 'b', targetTemplateId: 'B', date: '2026-10-30' })
  })

  it('ne remplace jamais une séance plus prioritaire', () => {
    const all = week([
      ses({ id: 'b', date: '2026-10-26', templateId: 'B' }),
      ses({ id: 'a', date: '2026-10-30', templateId: 'A' }),
      ses({ id: 'c', date: '2026-10-31', templateId: 'B', kind: 'prep' }), // samedi déjà occupé
    ])
    const opts = proposeReschedule(all[2], all, '2026-10-30')
    expect(opts.some((o) => o.kind === 'replace')).toBe(false)
  })

  it('semaine terminée : seule option, ne pas rattraper (pas de report sur la semaine suivante)', () => {
    const all = week([ses({ id: 'a', date: '2026-10-26', templateId: 'A' })])
    expect(proposeReschedule(all[2], all, '2026-11-02')).toEqual([{ kind: 'skip' }])
  })
})

// ---------- Mobilité ----------

describe('routines de mobilité', () => {
  it('la routine 5 min et la routine 15 min tiennent dans leur durée annoncée', () => {
    const m5 = estimateDurationSec('M5') / 60
    const m15 = estimateDurationSec('M15') / 60
    expect(m5).toBeGreaterThanOrEqual(4)
    expect(m5).toBeLessThanOrEqual(6)
    expect(m15).toBeGreaterThanOrEqual(13)
    expect(m15).toBeLessThanOrEqual(17)
    expect(TEMPLATES.M5.durationMin).toBe(5)
    expect(TEMPLATES.M15.durationMin).toBe(15)
  })
  it('se font sans matériel et ne contiennent que de la mobilité', () => {
    for (const id of ['M5', 'M15'] as const) {
      const slots = buildSession(id, 'home', [])
      expect(slots).toHaveLength(TEMPLATES[id].slots.length)
      expect(slots.every((s) => s.exercise.category === 'mobilite' && s.exercise.equipment.length === 0)).toBe(true)
    }
  })
})
