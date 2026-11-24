import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppDB, db, DEFAULT_SETTINGS, useDatabase } from './db'
import * as repo from './repo'
import { exportBackup, importBackup, parseBackup } from './backup'
import { DEFAULT_TEMPLATE_NAMES, normalizeTemplateNames, setTemplateNames, TEMPLATE_IDS, templateName } from '../domain/templates'
import { describeOption } from '../domain/reschedule'

let n = 0
beforeEach(async () => {
  useDatabase(new AppDB(`names-${n++}`))
  await db.open()
})
afterEach(() => setTemplateNames(null))

describe('noms des séances : règles', () => {
  it('reprend le nom par défaut pour un nom manquant, vide ou invalide, et coupe les noms trop longs', () => {
    const names = normalizeTemplateNames({ A: '  Jambes lourdes ', B: '   ', C: 42, M5: 'x'.repeat(80) })
    expect(names.A).toBe('Jambes lourdes')
    expect(names.B).toBe(DEFAULT_TEMPLATE_NAMES.B)
    expect(names.C).toBe(DEFAULT_TEMPLATE_NAMES.C)
    expect(names.M5).toHaveLength(60)
    expect(Object.keys(names).sort()).toEqual([...TEMPLATE_IDS].sort())
  })

  it('le nom choisi est repris par les messages de l’application', () => {
    expect(templateName('A')).toBe('A — Force bas du corps + tronc')
    setTemplateNames({ A: 'Jambes', B: 'Haut du corps' })
    expect(templateName('A')).toBe('Jambes')
    const text = describeOption({ kind: 'replace', targetId: 'x', targetTemplateId: 'B', date: '2026-11-05' }, 'A', (d) => d)
    expect(text).toBe('Faire Jambes à la place de Haut du corps (2026-11-05), plus prioritaire pour la force')
  })
})

describe('noms des séances : stockage', () => {
  it('une nouvelle installation enregistre tous les noms (l’accueil les lit dans la base)', async () => {
    await repo.getSettings()
    expect((await db.settings.get('main'))?.templateNames).toEqual(DEFAULT_TEMPLATE_NAMES)
  })

  it('enregistre un nom modifié, nettoyé, et refuse un nom vide sans rien écrire', async () => {
    const s = await repo.getSettings()
    await repo.saveSettings({ ...s, templateNames: { ...s.templateNames, C: '  Explosivité  ' } })
    expect((await db.settings.get('main'))?.templateNames.C).toBe('Explosivité')

    await expect(repo.saveSettings({ ...s, templateNames: { ...s.templateNames, A: ' ' } })).rejects.toThrow(/séance A vide/)
    expect((await db.settings.get('main'))?.templateNames.A).toBe(DEFAULT_TEMPLATE_NAMES.A)
  })

  it('migration : une base v2 reçoit les noms par défaut, sans toucher au reste', async () => {
    const { default: Dexie } = await import('dexie')
    const name = `migr-names-${n++}`
    const v2 = new Dexie(name)
    v2.version(1).stores({ settings: 'id', sessions: 'id, date, kind, status', weeks: 'weekStart', workouts: 'id, plannedSessionId, startedAt', sets: 'id, workoutLogId, exerciseId, loggedAt', combatLogs: 'id, plannedSessionId, date' })
    v2.version(2).stores({ checkins: 'date' })
    const old: Record<string, unknown> = { ...DEFAULT_SETTINGS, backpackMaxKg: 12 }
    delete old.templateNames
    await v2.table('settings').put(old)
    v2.close()

    const v3 = new AppDB(name)
    await v3.open()
    const s = await v3.settings.get('main')
    expect(s?.templateNames).toEqual(DEFAULT_TEMPLATE_NAMES)
    expect(s?.backpackMaxKg).toBe(12)
    v3.close()
  })

  it('sauvegarde : les noms sont exportés ; un fichier v2 sans noms s’importe avec les noms par défaut', async () => {
    const s = await repo.getSettings()
    await repo.saveSettings({ ...s, templateNames: { ...s.templateNames, B: 'Haut du corps' } })
    const backup = await exportBackup()
    expect(backup.schemaVersion).toBe(3)

    useDatabase(new AppDB(`names-import-${n++}`))
    await importBackup(parseBackup(JSON.stringify(backup)))
    expect((await db.settings.get('main'))?.templateNames.B).toBe('Haut du corps')

    const v2 = JSON.parse(JSON.stringify(backup))
    v2.schemaVersion = 2
    delete v2.data.settings[0].templateNames
    useDatabase(new AppDB(`names-import-v2-${n++}`))
    await importBackup(parseBackup(JSON.stringify(v2)))
    expect((await db.settings.get('main'))?.templateNames).toEqual(DEFAULT_TEMPLATE_NAMES)
  })
})
