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

describe('étape 4 : récupération, séances manquées, historique', () => {
  const ck = { sleepHours: 7, sleepQuality: 3, energy: 3, fatigue: 3, soreness: 2, motivation: 4 }

  it('un point de récupération par jour, modifiable, et refus des valeurs hors échelle', async () => {
    await repo.saveCheckin({ date: '2026-10-29', ...ck })
    await repo.saveCheckin({ date: '2026-10-29', ...ck, energy: 5 })
    const list = await repo.listCheckins('2026-10-01', '2026-10-31')
    expect(list).toHaveLength(1)
    expect(list[0].energy).toBe(5)
    await expect(repo.saveCheckin({ date: '2026-10-30', ...ck, fatigue: 9 })).rejects.toThrow()
  })

  it('séance manquée : déplacement dans la semaine, ou abandon sans suppression', async () => {
    // Semaine du 26 oct. : kick mercredi (défaut), AMHE dimanche. A lundi manquée.
    const ws = '2026-10-26'
    await repo.ensureWeek(ws, ws)
    const a = await repo.addSession({ date: ws, startTime: '18:00', durationMin: 60, kind: 'prep', templateId: 'A', environment: 'gym', status: 'planned', source: 'generated' })
    const today = '2026-10-29'
    expect((await repo.listMissed(today)).map((s) => s.id)).toEqual([a])
    const opts = await repo.rescheduleOptions(a, today)
    const move = opts.find((o) => o.kind === 'move')!
    await repo.applyReschedule(a, move)
    const moved = (await db.sessions.get(a))!
    expect(moved.date >= today).toBe(true)
    expect(await repo.listMissed(today)).toEqual([])

    const b = await repo.addSession({ date: '2026-10-27', startTime: '18:00', durationMin: 60, kind: 'prep', templateId: 'B', environment: 'home', status: 'planned', source: 'generated' })
    await repo.applyReschedule(b, { kind: 'skip' })
    const skipped = (await db.sessions.get(b))!
    expect(skipped.status).toBe('cancelled')
    expect(skipped.notes).toMatch(/non rattrapée/)
  })

  it('remplacement : la séance prioritaire prend la place, la manquée est annulée', async () => {
    const ws = '2026-10-26'
    await repo.ensureWeek(ws, ws)
    const a = await repo.addSession({ date: ws, startTime: '18:00', durationMin: 60, kind: 'prep', templateId: 'A', environment: 'gym', status: 'planned', source: 'generated' })
    const b = await repo.addSession({ date: '2026-10-30', startTime: '18:00', durationMin: 60, kind: 'prep', templateId: 'B', environment: 'home', status: 'planned', source: 'generated' })
    const opts = await repo.rescheduleOptions(a, '2026-10-30')
    const replace = opts.find((o) => o.kind === 'replace')!
    expect(replace).toBeDefined()
    await repo.applyReschedule(a, replace)
    expect((await db.sessions.get(b))).toMatchObject({ templateId: 'A', environment: 'gym', date: '2026-10-30', status: 'planned' })
    expect((await db.sessions.get(a))?.status).toBe('cancelled')
    expect(await db.sessions.count()).toBe(4) // rien n'a été supprimé
  })

  it('mobilité rapide : crée une séance M5 ou M15 aujourd’hui', async () => {
    const id = await repo.startQuickMobility('M15', new Date(2026, 9, 29, 7, 5))
    expect(await db.sessions.get(id)).toMatchObject({ date: '2026-10-29', startTime: '07:05', durationMin: 15, kind: 'mobility', templateId: 'M15' })
    expect(await repo.startQuickMobility('M15', new Date(2026, 9, 29, 7, 6))).toBe(id) // pas de doublon
    expect(await repo.startQuickMobility('M5', new Date(2026, 9, 29, 7, 6))).not.toBe(id)
  })

  it('historique : séances passées ou renseignées, récentes d’abord, avec leurs séries', async () => {
    const old = await repo.addSession({ date: '2026-10-20', startTime: '18:00', durationMin: 60, kind: 'prep', templateId: 'B', environment: 'gym', status: 'planned', source: 'manual' })
    const w = await repo.startOrResumeWorkout(old)
    await repo.logSet({ workoutLogId: w.id, exerciseId: 'curl-halteres', setIndex: 0, reps: 15, loadKg: 6, rir: 2 })
    await repo.finishWorkout(w.id, 'done')
    await repo.addSession({ date: '2026-10-22', startTime: '18:00', durationMin: 60, kind: 'prep', templateId: 'A', environment: 'gym', status: 'planned', source: 'manual' })
    await repo.addSession({ date: '2026-11-05', startTime: '18:00', durationMin: 60, kind: 'prep', templateId: 'C', environment: 'gym', status: 'planned', source: 'manual' })
    const { entries, hasMore } = await repo.listHistory(10, '2026-10-29')
    expect(entries.map((e) => e.session.date)).toEqual(['2026-10-22', '2026-10-20']) // la séance future n'apparaît pas
    expect(entries[1].sets.map((s) => s.loadKg)).toEqual([6])
    expect(hasMore).toBe(false)
    expect((await repo.listHistory(1, '2026-10-29')).hasMore).toBe(true)
  })

  it('sauvegarde v2 : les points de récupération sont exportés et réimportés ; un fichier v1 reste importable', async () => {
    await repo.saveCheckin({ date: '2026-10-29', ...ck })
    const backup = await exportBackup()
    expect(backup.schemaVersion).toBe(2)
    useDatabase(new AppDB(`import-v2-${n++}`))
    await importBackup(parseBackup(JSON.stringify(backup)))
    expect(await db.checkins.count()).toBe(1)

    const v1 = { ...backup, schemaVersion: 1, data: { ...backup.data } } as Record<string, unknown> & { data: Record<string, unknown> }
    delete v1.data.checkins
    useDatabase(new AppDB(`import-v1-${n++}`))
    await importBackup(parseBackup(JSON.stringify(v1)))
    expect(await db.checkins.count()).toBe(0)
    expect(await db.sessions.count()).toBe(backup.data.sessions.length)
  })

  it('migration : une base v1 existante s’ouvre en v2 sans perte', async () => {
    const { default: Dexie } = await import('dexie')
    const name = `migr-${n++}`
    const v1 = new Dexie(name)
    v1.version(1).stores({ settings: 'id', sessions: 'id, date, kind, status', weeks: 'weekStart', workouts: 'id, plannedSessionId, startedAt', sets: 'id, workoutLogId, exerciseId, loggedAt', combatLogs: 'id, plannedSessionId, date' })
    await v1.table('sessions').add({ id: 'x', date: '2026-10-20', startTime: '18:00', durationMin: 60, kind: 'prep', templateId: 'B', status: 'done', source: 'manual', createdAt: '', updatedAt: '' })
    v1.close()
    const v2 = new AppDB(name)
    await v2.open()
    expect(await v2.sessions.get('x')).toBeDefined()
    expect(await v2.checkins.count()).toBe(0)
    v2.close()
  })
})
