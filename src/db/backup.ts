import { db, nowISO } from './db'
import type { CombatLog, PlannedSession, RecoveryCheckin, SetLog, Settings, WeekRecord, WorkoutLog } from '../domain/types'

export const BACKUP_APP = 'combat-prep'
/** v2 : ajout des points de récupération (`checkins`). Les fichiers v1 restent importables. */
export const BACKUP_SCHEMA_VERSION = 2

export interface BackupFile {
  app: typeof BACKUP_APP
  schemaVersion: number
  exportedAt: string
  data: {
    settings: Settings[]
    sessions: PlannedSession[]
    weeks: WeekRecord[]
    workouts: WorkoutLog[]
    sets: SetLog[]
    combatLogs: CombatLog[]
    checkins: RecoveryCheckin[]
  }
}

export async function exportBackup(): Promise<BackupFile> {
  const backup: BackupFile = {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: nowISO(),
    data: {
      settings: await db.settings.toArray(),
      sessions: await db.sessions.toArray(),
      weeks: await db.weeks.toArray(),
      workouts: await db.workouts.toArray(),
      sets: await db.sets.toArray(),
      combatLogs: await db.combatLogs.toArray(),
      checkins: await db.checkins.toArray(),
    },
  }
  return backup
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const allHave = (arr: unknown, keys: string[]) => Array.isArray(arr) && arr.every((x) => isObj(x) && keys.every((k) => k in x))

/** Vérifie la structure d'un fichier de sauvegarde. Lève une erreur explicite sinon. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Le fichier n’est pas un JSON valide.')
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) throw new Error('Ce fichier n’est pas une sauvegarde de cette application.')
  if (typeof raw.schemaVersion !== 'number' || raw.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error('Version de sauvegarde non prise en charge : mets l’application à jour.')
  }
  const d = raw.data
  if (!isObj(d)) throw new Error('Sauvegarde incomplète.')
  if (raw.schemaVersion < 2 && d.checkins === undefined) d.checkins = [] // sauvegarde v1 : pas encore de suivi de récupération
  const checks: [string, string[]][] = [
    ['settings', ['id']],
    ['sessions', ['id', 'date', 'startTime', 'durationMin', 'kind', 'status']],
    ['weeks', ['weekStart']],
    ['workouts', ['id', 'plannedSessionId', 'status']],
    ['sets', ['id', 'workoutLogId', 'exerciseId']],
    ['combatLogs', ['id', 'plannedSessionId']],
    ['checkins', ['date', 'sleepHours', 'energy', 'fatigue']],
  ]
  for (const [key, fields] of checks) {
    if (!allHave(d[key], fields)) throw new Error(`Sauvegarde invalide : section « ${key} » incorrecte.`)
  }
  return raw as unknown as BackupFile
}

/** Remplace TOUTES les données locales par la sauvegarde (après confirmation dans l'interface). */
export async function importBackup(file: BackupFile): Promise<void> {
  await db.transaction('rw', [db.settings, db.sessions, db.weeks, db.workouts, db.sets, db.combatLogs, db.checkins], async () => {
    await Promise.all([
      db.settings.clear(), db.sessions.clear(), db.weeks.clear(), db.workouts.clear(), db.sets.clear(), db.combatLogs.clear(), db.checkins.clear(),
    ])
    await db.settings.bulkPut(file.data.settings)
    await db.sessions.bulkPut(file.data.sessions)
    await db.weeks.bulkPut(file.data.weeks)
    await db.workouts.bulkPut(file.data.workouts)
    await db.sets.bulkPut(file.data.sets)
    await db.combatLogs.bulkPut(file.data.combatLogs)
    await db.checkins.bulkPut(file.data.checkins)
  })
}

export function backupSummary(f: BackupFile): string {
  const d = f.data
  return `${d.sessions.length} séances, ${d.workouts.length} entraînements, ${d.sets.length} séries, ${d.combatLogs.length} combats, ${d.checkins.length} points de récupération — exportée le ${new Date(f.exportedAt).toLocaleString('fr-FR')}`
}
