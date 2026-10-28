import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppDB, db, useDatabase } from './db'
import * as repo from './repo'
import { exportBackup, importBackup, parseBackup } from './backup'
import { addDays, dayIndex } from '../domain/dates'
import { hardViolations } from '../domain/planner'

const WEEK = '2026-11-02' // lundi
const TODAY = '2026-10-28'

let n = 0
beforeEach(async () => {
  useDatabase(new AppDB(`test-${n++}`))
  await db.open()
})

describe('semaine et occurrences récurrentes', () => {
  it('crée AMHE (dimanche) et kick-boxing à la première ouverture, une seule fois', async () => {
    await repo.ensureWeek(WEEK, TODAY)
    await repo.ensureWeek(WEEK, TODAY)
    const s = await repo.listRange(WEEK, addDays(WEEK, 6))
    expect(s).toHaveLength(2)
    const amhe = s.find((x) => x.kind === 'amhe')!
    expect(dayIndex(amhe.date)).toBe(6)
    expect(amhe.startTime).toBe('13:00')
    expect(amhe.durationMin).toBe(240)
  })

  it('ne remplit pas les semaines passées', async () => {
    await repo.ensureWeek('2026-10-12', TODAY)
    expect(await db.sessions.count()).toBe(0)
  })

  it('déplacer le kick-boxing une semaine ne modifie pas les semaines suivantes', async () => {
    await repo.ensureWeek(WEEK, TODAY)
    await repo.setKickDayForWeek(WEEK, 4) // vendredi
    const next = addDays(WEEK, 7)
    await repo.ensureWeek(next, TODAY)
    const k1 = (await repo.listRange(WEEK, addDays(WEEK, 6))).find((s) => s.kind === 'kickboxing')!
    const k2 = (await repo.listRange(next, addDays(next, 6))).find((s) => s.kind === 'kickboxing')!
    expect(dayIndex(k1.date)).toBe(4)
    expect(dayIndex(k2.date)).toBe(2) // jour par défaut (mercredi) inchangé
    expect((await repo.getSettings()).kickboxing.weekday).toBe(2)
  })
})

describe('génération de la semaine', () => {
  it('génère 3 séances autour des combats et la régénération remplace sans dupliquer', async () => {
    await repo.ensureWeek(WEEK, TODAY)
    await repo.setKickDayForWeek(WEEK, 1) // mardi
    await repo.generateWeek(WEEK)
    await repo.generateWeek(WEEK)
    const s = await repo.listRange(WEEK, addDays(WEEK, 6))
    const prep = s.filter((x) => x.kind === 'prep')
    expect(prep).toHaveLength(3)
    const combat = s.filter((x) => x.kind === 'amhe' || x.kind === 'kickboxing').map((x) => ({ day: dayIndex(x.date), kind: x.kind as 'amhe' }))
    expect(hardViolations(prep.map((p) => ({ day: dayIndex(p.date), templateId: p.templateId! })), combat)).toEqual([])
  })

  it('conserve une séance effectuée et ne la regénère pas', async () => {
    await repo.ensureWeek(WEEK, TODAY)
    await repo.generateWeek(WEEK)
    const a = (await repo.listRange(WEEK, addDays(WEEK, 6))).find((x) => x.templateId === 'A')!
    await repo.updateSession(a.id, { status: 'done' })
    await repo.generateWeek(WEEK)
    const prep = (await repo.listRange(WEEK, addDays(WEEK, 6))).filter((x) => x.kind === 'prep')
    expect(prep.filter((p) => p.templateId === 'A')).toHaveLength(1)
    expect(prep.find((p) => p.id === a.id)?.status).toBe('done')
    expect(prep).toHaveLength(3)
  })

  it('copie la semaine précédente en remettant les statuts à « prévue »', async () => {
    await repo.ensureWeek(WEEK, TODAY)
    await repo.generateWeek(WEEK)
    const first = await repo.listRange(WEEK, addDays(WEEK, 6))
    await repo.updateSession(first[0].id, { status: 'done' })
    const next = addDays(WEEK, 7)
    const copied = await repo.copyPreviousWeek(next)
    const s = await repo.listRange(next, addDays(next, 6))
    expect(s).toHaveLength(copied)
    expect(s.every((x) => x.status === 'planned')).toBe(true)
  })
})

describe('validation et suppression', () => {
  it('refuse une durée invalide', async () => {
    await expect(repo.addSession({ date: WEEK, startTime: '18:00', durationMin: 0, kind: 'other', status: 'planned', source: 'manual' })).rejects.toThrow()
    await expect(repo.addSession({ date: WEEK, startTime: '25:00', durationMin: 30, kind: 'other', status: 'planned', source: 'manual' })).rejects.toThrow()
  })
  it('supprime une séance et ses séries liées', async () => {
    const id = await repo.addSession({ date: WEEK, startTime: '18:00', durationMin: 60, kind: 'prep', templateId: 'B', environment: 'home', status: 'planned', source: 'manual' })
    const w = await repo.startOrResumeWorkout(id)
    await repo.logSet({ workoutLogId: w.id, exerciseId: 'pompes', setIndex: 0, reps: 10 })
    expect(await repo.linkedDataCount(id)).toBe(2)
    await repo.deleteSession(id)
    expect(await db.sets.count()).toBe(0)
    expect(await db.workouts.count()).toBe(0)
  })
})

describe('suivi de séance et historique', () => {
  it('enregistre les séries, termine la séance et alimente l’historique', async () => {
    const id = await repo.addSession({ date: WEEK, startTime: '18:00', durationMin: 60, kind: 'prep', templateId: 'B', environment: 'gym', status: 'planned', source: 'manual' })
    const w = await repo.startOrResumeWorkout(id)
    expect((await repo.startOrResumeWorkout(id)).id).toBe(w.id) // reprise
    for (let i = 0; i < 3; i++) await repo.logSet({ workoutLogId: w.id, exerciseId: 'curl-halteres', setIndex: i, reps: 10, loadKg: 8, rir: 2 })
    await repo.finishWorkout(w.id, 'partial')
    expect((await db.sessions.get(id))?.status).toBe('partial')
    const h = await repo.exerciseHistory('curl-halteres')
    expect(h).toHaveLength(1)
    expect(h[0].sets.map((s) => s.reps)).toEqual([10, 10, 10])
  })
})

describe('persistance et sauvegarde', () => {
  it('les données persistent dans une nouvelle connexion à la base', async () => {
    useDatabase(new AppDB('persist-test'))
    await repo.ensureWeek(WEEK, TODAY)
    db.close()
    const reopened = new AppDB('persist-test')
    await reopened.open()
    expect(await reopened.sessions.count()).toBe(2)
    reopened.close()
  })

  it('export puis import restitue des données identiques', async () => {
    await repo.ensureWeek(WEEK, TODAY)
    await repo.generateWeek(WEEK)
    const backup = await exportBackup()
    const text = JSON.stringify(backup)
    useDatabase(new AppDB(`import-${n++}`))
    await importBackup(parseBackup(text))
    const again = await exportBackup()
    expect(again.data).toEqual(backup.data)
  })

  it('rejette un fichier invalide', () => {
    expect(() => parseBackup('pas du json')).toThrow(/JSON/)
    expect(() => parseBackup(JSON.stringify({ app: 'autre' }))).toThrow(/sauvegarde/)
    expect(() => parseBackup(JSON.stringify({ app: 'combat-prep', schemaVersion: 1, data: { settings: [], sessions: [{ id: 1 }] } }))).toThrow(/sessions/)
  })
})
