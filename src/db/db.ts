import Dexie, { type EntityTable } from 'dexie'
import type { CombatLog, PlannedSession, SetLog, Settings, WeekRecord, WorkoutLog } from '../domain/types'
import { ALL_GYM_EQUIPMENT } from '../domain/exercises'

export class AppDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>
  sessions!: EntityTable<PlannedSession, 'id'>
  weeks!: EntityTable<WeekRecord, 'weekStart'>
  workouts!: EntityTable<WorkoutLog, 'id'>
  sets!: EntityTable<SetLog, 'id'>
  combatLogs!: EntityTable<CombatLog, 'id'>

  constructor(name = 'combat-prep') {
    super(name)
    this.version(1).stores({
      settings: 'id',
      sessions: 'id, date, kind, status',
      weeks: 'weekStart',
      workouts: 'id, plannedSessionId, startedAt',
      sets: 'id, workoutLogId, exerciseId, loggedAt',
      combatLogs: 'id, plannedSessionId, date',
    })
  }
}

export let db = new AppDB()

/** Utilisé par les tests pour repartir d'une base vide. */
export function useDatabase(instance: AppDB) {
  db = instance
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  level: 'debutant',
  goal: 'masse_force',
  prepSessionsPerWeek: 3,
  prepDurationMin: 60,
  prepDefaultTime: '18:00',
  gymSessionsPerWeek: 2,
  amhe: { weekday: 6, startTime: '13:00', durationMin: 240 },
  kickboxing: { weekday: 2, startTime: '19:30', durationMin: 90 },
  homeEquipment: ['bands', 'parallettes', 'pullupBar', 'rings'],
  gymEquipment: ALL_GYM_EQUIPMENT,
  backpackMaxKg: 0,
  dumbbellIncrementKg: 2,
  barbellIncrementKg: 2.5,
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const nowISO = () => new Date().toISOString()
