import { db, DEFAULT_SETTINGS, nowISO, uid } from './db'
import { addDays, dayIndex, isValidISODate, isValidTime, todayISO, toISODate, weekDates, weekStartOf } from '../domain/dates'
import { generateWeekPlan, type CombatDay, type PlannerResult } from '../domain/planner'
import { PREP_TEMPLATE_IDS, TEMPLATES } from '../domain/templates'
import type { SessionSets } from '../domain/progression'
import { validateCheckin } from '../domain/recovery'
import { findMissed, proposeReschedule, type RescheduleOption } from '../domain/reschedule'
import type {
  CombatLog, DayIndex, PlannedSession, RecoveryCheckin, SetLog, Settings, TemplateId, WorkoutLog,
} from '../domain/types'

// ---------- Paramètres ----------

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('main')
  if (s) return { ...DEFAULT_SETTINGS, ...s }
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export function validateSettings(s: Settings): string[] {
  const errs: string[] = []
  if (!isValidTime(s.amhe.startTime) || !isValidTime(s.kickboxing.startTime) || !isValidTime(s.prepDefaultTime)) {
    errs.push('Heure invalide (format HH:MM attendu).')
  }
  if (s.kickboxing.durationMin < 15 || s.kickboxing.durationMin > 300) errs.push('Durée du kick-boxing entre 15 et 300 min.')
  if (s.amhe.durationMin < 15 || s.amhe.durationMin > 480) errs.push('Durée des AMHE entre 15 et 480 min.')
  if (s.gymSessionsPerWeek < 0 || s.gymSessionsPerWeek > 7) errs.push('Nombre de séances en salle entre 0 et 7.')
  if (s.backpackMaxKg < 0 || s.backpackMaxKg > 60) errs.push('Poids du sac entre 0 et 60 kg.')
  if (s.dumbbellIncrementKg <= 0 || s.dumbbellIncrementKg > 10) errs.push('Incrément haltères entre 0,5 et 10 kg.')
  return errs
}

export async function saveSettings(s: Settings): Promise<void> {
  const errs = validateSettings(s)
  if (errs.length) throw new Error(errs.join(' '))
  await db.settings.put(s)
}

// ---------- Séances ----------

export function validateSession(s: PlannedSession): string[] {
  const errs: string[] = []
  if (!isValidISODate(s.date)) errs.push('Date invalide.')
  if (!isValidTime(s.startTime)) errs.push('Heure invalide.')
  if (!Number.isFinite(s.durationMin) || s.durationMin < 5 || s.durationMin > 480) errs.push('Durée entre 5 et 480 minutes.')
  if (s.kind === 'prep' && !s.templateId) errs.push('Choisis une séance type.')
  return errs
}

export async function listRange(from: string, to: string): Promise<PlannedSession[]> {
  return db.sessions.where('date').between(from, to, true, true).sortBy('date')
}

/**
 * Crée les occurrences récurrentes (AMHE, kick-boxing) d'une semaine la première fois
 * qu'elle est affichée. Les semaines passées ne sont pas remplies (pas de fausses données).
 * Modifier ensuite une occurrence ne touche jamais la règle récurrente.
 */
export async function ensureWeek(weekStart: string, today = todayISO()): Promise<void> {
  if (weekStart < weekStartOf(today)) return
  await db.transaction('rw', db.weeks, db.sessions, db.settings, async () => {
    if (await db.weeks.get(weekStart)) return
    const s = await getSettings()
    const now = nowISO()
    const mk = (kind: 'amhe' | 'kickboxing', slot: Settings['amhe']): PlannedSession => ({
      id: uid(), date: addDays(weekStart, slot.weekday), startTime: slot.startTime, durationMin: slot.durationMin,
      kind, status: 'planned', source: 'recurring', createdAt: now, updatedAt: now,
    })
    await db.sessions.bulkAdd([mk('amhe', s.amhe), mk('kickboxing', s.kickboxing)])
    await db.weeks.put({ weekStart, initializedAt: now })
  })
}

export async function addSession(input: Omit<PlannedSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = nowISO()
  const s: PlannedSession = { ...input, id: uid(), createdAt: now, updatedAt: now }
  const errs = validateSession(s)
  if (errs.length) throw new Error(errs.join(' '))
  await db.sessions.add(s)
  return s.id
}

export async function updateSession(id: string, patch: Partial<PlannedSession>): Promise<void> {
  const cur = await db.sessions.get(id)
  if (!cur) throw new Error('Séance introuvable.')
  const next = { ...cur, ...patch, id, updatedAt: nowISO() }
  const errs = validateSession(next)
  if (errs.length) throw new Error(errs.join(' '))
  await db.sessions.put(next)
}

export async function moveSession(id: string, date: string): Promise<void> {
  await updateSession(id, { date })
}

/** Reporte une séance au lendemain. */
export async function postponeSession(id: string): Promise<void> {
  const cur = await db.sessions.get(id)
  if (!cur) throw new Error('Séance introuvable.')
  await updateSession(id, { date: addDays(cur.date, 1) })
}

/** Nombre de données liées (séries, journaux) qui seraient supprimées avec la séance. */
export async function linkedDataCount(id: string): Promise<number> {
  const workouts = await db.workouts.where('plannedSessionId').equals(id).toArray()
  let n = workouts.length
  for (const w of workouts) n += await db.sets.where('workoutLogId').equals(w.id).count()
  n += await db.combatLogs.where('plannedSessionId').equals(id).count()
  return n
}

/** Suppression explicite (l'interface demande confirmation avant). */
export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.workouts, db.sets, db.combatLogs, async () => {
    const workouts = await db.workouts.where('plannedSessionId').equals(id).toArray()
    for (const w of workouts) await db.sets.where('workoutLogId').equals(w.id).delete()
    await db.workouts.where('plannedSessionId').equals(id).delete()
    await db.combatLogs.where('plannedSessionId').equals(id).delete()
    await db.sessions.delete(id)
  })
}

/** Change le jour du kick-boxing pour CETTE semaine uniquement. */
export async function setKickDayForWeek(weekStart: string, day: DayIndex): Promise<void> {
  const week = await listRange(weekStart, addDays(weekStart, 6))
  const kick = week.find((s) => s.kind === 'kickboxing' && s.status !== 'cancelled')
  const date = addDays(weekStart, day)
  if (kick) {
    await updateSession(kick.id, { date })
  } else {
    const s = await getSettings()
    await addSession({
      date, startTime: s.kickboxing.startTime, durationMin: s.kickboxing.durationMin, kind: 'kickboxing',
      status: 'planned', source: 'manual',
    })
  }
}

// ---------- Génération ----------

const isGeneratedReplaceable = (s: PlannedSession) =>
  s.source === 'generated' && s.status === 'planned' && (s.kind === 'prep' || s.kind === 'mobility')

export async function sessionsReplacedByGeneration(weekStart: string): Promise<number> {
  const week = await listRange(weekStart, addDays(weekStart, 6))
  return week.filter(isGeneratedReplaceable).length
}

export async function generateWeek(weekStart: string): Promise<PlannerResult> {
  const settings = await getSettings()
  const week = await listRange(addDays(weekStart, -1), addDays(weekStart, 6))
  const inWeek = week.filter((s) => s.date >= weekStart)
  const active = inWeek.filter((s) => s.status !== 'cancelled')

  const combatDays: CombatDay[] = active
    .filter((s) => s.kind === 'amhe' || s.kind === 'kickboxing')
    .map((s) => ({ day: dayIndex(s.date), kind: s.kind as 'amhe' | 'kickboxing' }))

  const fixedPrep = active.filter((s) => s.kind === 'prep' && !isGeneratedReplaceable(s) && s.templateId)
  const fixed = fixedPrep.map((s) => ({ day: dayIndex(s.date), templateId: s.templateId! }))
  const wanted = PREP_TEMPLATE_IDS.slice(0, Math.min(3, settings.prepSessionsPerWeek))
  if (settings.prepSessionsPerWeek === 4) wanted.push('B')
  const toPlace = [...wanted]
  for (const f of fixed) {
    const i = toPlace.indexOf(f.templateId)
    if (i >= 0) toPlace.splice(i, 1)
  }

  const prevSunday = week.find((s) => s.date === addDays(weekStart, -1) && s.kind === 'amhe' && s.status !== 'cancelled')
  const previousSundayCombat = prevSunday ? true : !(await db.weeks.get(addDays(weekStart, -7)))

  const gymUsed = fixedPrep.filter((s) => s.environment === 'gym').length
  const result = generateWeekPlan({
    combatDays, fixed, toPlace, previousSundayCombat,
    gymSessionsPerWeek: Math.max(0, settings.gymSessionsPerWeek - gymUsed),
  })

  const now = nowISO()
  const newSessions: PlannedSession[] = [
    ...result.prep.map((p) => ({
      id: uid(), date: addDays(weekStart, p.day), startTime: settings.prepDefaultTime,
      durationMin: TEMPLATES[p.templateId].durationMin, kind: 'prep' as const, templateId: p.templateId,
      environment: p.environment, status: 'planned' as const, source: 'generated' as const, createdAt: now, updatedAt: now,
    })),
    ...result.mobility.map((d) => ({
      id: uid(), date: addDays(weekStart, d), startTime: '21:00', durationMin: 10, kind: 'mobility' as const,
      templateId: 'M10' as TemplateId, environment: 'home' as const, status: 'planned' as const, source: 'generated' as const,
      createdAt: now, updatedAt: now,
    })),
  ]
  await db.transaction('rw', db.sessions, async () => {
    const toRemove = inWeek.filter(isGeneratedReplaceable).map((s) => s.id)
    await db.sessions.bulkDelete(toRemove)
    await db.sessions.bulkAdd(newSessions)
  })
  return result
}

/** Séances « prévues » de la semaine cible qui seraient remplacées par la copie. */
export async function sessionsReplacedByCopy(weekStart: string): Promise<number> {
  const week = await listRange(weekStart, addDays(weekStart, 6))
  return week.filter((s) => s.status === 'planned').length
}

/**
 * Copie la semaine précédente (toutes les séances non annulées, remises à « prévue »).
 * Les séances déjà effectuées de la semaine cible sont conservées.
 */
export async function copyPreviousWeek(weekStart: string): Promise<number> {
  const prevStart = addDays(weekStart, -7)
  const prev = (await listRange(prevStart, addDays(prevStart, 6))).filter((s) => s.status !== 'cancelled')
  if (!prev.length) throw new Error('La semaine précédente est vide : rien à copier.')
  const now = nowISO()
  await db.transaction('rw', db.sessions, db.weeks, async () => {
    const target = await listRange(weekStart, addDays(weekStart, 6))
    await db.sessions.bulkDelete(target.filter((s) => s.status === 'planned').map((s) => s.id))
    await db.sessions.bulkAdd(
      prev.map((s) => ({
        ...s, id: uid(), date: addDays(s.date, 7), status: 'planned' as const, source: 'copied' as const,
        createdAt: now, updatedAt: now,
      })),
    )
    await db.weeks.put({ weekStart, initializedAt: now })
  })
  return prev.length
}

// ---------- Entraînement ----------

export async function startOrResumeWorkout(sessionId: string): Promise<WorkoutLog> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Séance introuvable.')
  const existing = await db.workouts.where('plannedSessionId').equals(sessionId).filter((w) => w.status === 'in_progress').first()
  if (existing) return existing
  const w: WorkoutLog = {
    id: uid(), plannedSessionId: sessionId, templateId: session.templateId, environment: session.environment,
    startedAt: nowISO(), status: 'in_progress',
  }
  await db.workouts.add(w)
  return w
}

export async function logSet(set: Omit<SetLog, 'id' | 'loggedAt'>): Promise<SetLog> {
  if (set.reps !== undefined && (set.reps < 0 || set.reps > 200)) throw new Error('Répétitions invalides.')
  if (set.loadKg !== undefined && (set.loadKg < 0 || set.loadKg > 500)) throw new Error('Charge invalide.')
  if (set.rir !== undefined && (set.rir < 0 || set.rir > 10)) throw new Error('RIR invalide.')
  const full: SetLog = { ...set, id: uid(), loggedAt: nowISO() }
  await db.sets.add(full)
  return full
}

export async function deleteSet(id: string) {
  await db.sets.delete(id)
}

export async function finishWorkout(workoutId: string, status: 'done' | 'partial' | 'abandoned', feeling?: number, notes?: string) {
  const w = await db.workouts.get(workoutId)
  if (!w) throw new Error('Entraînement introuvable.')
  await db.transaction('rw', db.workouts, db.sessions, async () => {
    await db.workouts.update(workoutId, { status, endedAt: nowISO(), feeling, notes })
    await db.sessions.update(w.plannedSessionId, {
      status: status === 'done' ? 'done' : status === 'partial' ? 'partial' : 'cancelled', updatedAt: nowISO(),
    })
  })
}

/** Historique d'un exercice, séance la plus récente d'abord (hors entraînement en cours). */
export async function exerciseHistory(exerciseId: string, excludeWorkoutId?: string, limit = 5): Promise<SessionSets[]> {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray()
  const groups = new Map<string, SetLog[]>()
  for (const s of sets) {
    if (s.workoutLogId === excludeWorkoutId) continue
    if (!groups.has(s.workoutLogId)) groups.set(s.workoutLogId, [])
    groups.get(s.workoutLogId)!.push(s)
  }
  return [...groups.values()]
    .map((g) => ({ date: g.reduce((m, s) => (s.loggedAt < m ? s.loggedAt : m), g[0].loggedAt), sets: g.sort((a, b) => a.setIndex - b.setIndex) }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit)
}

export async function saveCombatLog(sessionId: string, log: Omit<CombatLog, 'id' | 'plannedSessionId' | 'loggedAt' | 'date' | 'discipline'>) {
  const s = await db.sessions.get(sessionId)
  if (!s || (s.kind !== 'amhe' && s.kind !== 'kickboxing')) throw new Error('Séance de combat introuvable.')
  for (const v of [log.intensity, log.fatigueAfter]) if (v < 1 || v > 10) throw new Error('Valeurs entre 1 et 10.')
  await db.transaction('rw', db.combatLogs, db.sessions, async () => {
    await db.combatLogs.where('plannedSessionId').equals(sessionId).delete()
    await db.combatLogs.add({ ...log, id: uid(), plannedSessionId: sessionId, date: s.date, discipline: s.kind as 'amhe' | 'kickboxing', loggedAt: nowISO() })
    await db.sessions.update(sessionId, { status: 'done', updatedAt: nowISO() })
  })
}

// ---------- Récupération ----------

export async function saveCheckin(c: Omit<RecoveryCheckin, 'updatedAt'>): Promise<void> {
  const full: RecoveryCheckin = { ...c, updatedAt: nowISO() }
  if (!isValidISODate(full.date)) throw new Error('Date invalide.')
  const errs = validateCheckin(full)
  if (errs.length) throw new Error(errs.join(' '))
  await db.checkins.put(full)
}

export async function listCheckins(from: string, to: string): Promise<RecoveryCheckin[]> {
  return db.checkins.where('date').between(from, to, true, true).sortBy('date')
}

// ---------- Séances manquées ----------

/**
 * Séances de préparation manquées de la semaine en cours et de la précédente
 * (au-delà, la semaine est close et il n'y a plus rien à réorganiser).
 */
export async function listMissed(today = todayISO()): Promise<PlannedSession[]> {
  const from = addDays(weekStartOf(today), -7)
  return findMissed(await listRange(from, addDays(today, -1)), today)
}

export async function rescheduleOptions(sessionId: string, today = todayISO()): Promise<RescheduleOption[]> {
  const missed = await db.sessions.get(sessionId)
  if (!missed) throw new Error('Séance introuvable.')
  const ws = weekStartOf(missed.date)
  return proposeReschedule(missed, await listRange(addDays(ws, -1), addDays(ws, 6)), today)
}

const appendNote = (notes: string | undefined, line: string) => (notes ? `${notes}
${line}` : line)

/** Applique une option de réorganisation. Rien n'est supprimé : la séance non faite est marquée « annulée ». */
export async function applyReschedule(sessionId: string, option: RescheduleOption): Promise<void> {
  const missed = await db.sessions.get(sessionId)
  if (!missed) throw new Error('Séance introuvable.')
  if (option.kind === 'move') {
    await updateSession(sessionId, { date: option.date })
    return
  }
  if (option.kind === 'skip') {
    await updateSession(sessionId, { status: 'cancelled', notes: appendNote(missed.notes, 'Manquée, non rattrapée.') })
    return
  }
  const target = await db.sessions.get(option.targetId)
  if (!target || target.status !== 'planned') throw new Error('La séance à remplacer n’est plus disponible.')
  await db.transaction('rw', db.sessions, async () => {
    await updateSession(target.id, {
      templateId: missed.templateId, environment: missed.environment ?? target.environment, light: false,
      durationMin: TEMPLATES[missed.templateId!].durationMin,
      notes: appendNote(target.notes, `Remplace ${TEMPLATES[target.templateId!].short} (séance ${missed.templateId} manquée).`),
    })
    await updateSession(missed.id, {
      status: 'cancelled', notes: appendNote(missed.notes, `Manquée, faite le ${target.date} à la place de ${target.templateId}.`),
    })
  })
}

// ---------- Mobilité rapide ----------

/**
 * Crée une séance de mobilité maintenant (aujourd'hui, heure courante) et renvoie son id.
 * Si la même routine est déjà prévue aujourd'hui et pas encore faite, on la réutilise (pas de doublon).
 */
export async function startQuickMobility(templateId: 'M5' | 'M15', now = new Date()): Promise<string> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = toISODate(now)
  const existing = (await listRange(date, date)).find((s) => s.kind === 'mobility' && s.templateId === templateId && s.status === 'planned')
  if (existing) return existing.id
  return addSession({
    date, startTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`, durationMin: TEMPLATES[templateId].durationMin,
    kind: 'mobility', templateId, environment: 'home', status: 'planned', source: 'manual',
  })
}

// ---------- Historique ----------

export interface HistoryEntry {
  session: PlannedSession
  workouts: WorkoutLog[]
  sets: SetLog[]
  combat?: CombatLog
}

/** Séances passées ou renseignées, de la plus récente à la plus ancienne. */
export async function listHistory(limit: number, today = todayISO()): Promise<{ entries: HistoryEntry[]; hasMore: boolean }> {
  const all = await db.sessions
    .orderBy('date').reverse()
    .filter((s) => s.status !== 'planned' || s.date < today)
    .limit(limit + 1).toArray()
  const page = all.slice(0, limit)
  const ids = page.map((s) => s.id)
  const workouts = ids.length ? await db.workouts.where('plannedSessionId').anyOf(ids).toArray() : []
  const wIds = workouts.map((w) => w.id)
  const sets = wIds.length ? await db.sets.where('workoutLogId').anyOf(wIds).toArray() : []
  const combats = ids.length ? await db.combatLogs.where('plannedSessionId').anyOf(ids).toArray() : []
  const entries = page.map((session) => {
    const ws = workouts.filter((w) => w.plannedSessionId === session.id)
    const wsIds = new Set(ws.map((w) => w.id))
    return {
      session, workouts: ws,
      sets: sets.filter((x) => wsIds.has(x.workoutLogId)).sort((a, b) => (a.loggedAt < b.loggedAt ? -1 : 1)),
      combat: combats.find((c) => c.plannedSessionId === session.id),
    }
  })
  return { entries, hasMore: all.length > limit }
}

export { weekDates }
