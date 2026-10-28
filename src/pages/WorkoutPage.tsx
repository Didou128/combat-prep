import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import * as repo from '../db/repo'
import { buildSession, substitutesFor, type ResolvedSlot } from '../domain/templates'
import { getExercise } from '../domain/exercises'
import { suggestNext, type SessionSets, type Suggestion } from '../domain/progression'
import type { Settings, WorkoutLog } from '../domain/types'
import { errorMessage, Loading, Modal, Stepper, useConfirm, useToast } from '../ui/common'
import { equipmentFor } from './SessionPage'

const overridesKey = (wid: string) => `overrides:${wid}`
function loadOverrides(wid: string): Record<number, string> {
  try { return JSON.parse(localStorage.getItem(overridesKey(wid)) ?? '{}') } catch { return {} }
}
function saveOverrides(wid: string, o: Record<number, string>) {
  try { localStorage.setItem(overridesKey(wid), JSON.stringify(o)) } catch { /* stockage indisponible : on garde en mémoire */ }
}

function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const req = () => nav.wakeLock?.request('screen').then((l) => { lock = l }).catch(() => {})
    req()
    const onVis = () => document.visibilityState === 'visible' && req()
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release().catch(() => {}) }
  }, [])
}

/** Chronomètre basé sur l'heure de fin : reste juste même si l'écran s'est mis en veille. */
function RestTimer({ endAt, onChange }: { endAt: number | null; onChange: (v: number | null) => void }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!endAt) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [endAt])
  if (!endAt) return null
  const left = Math.max(0, Math.ceil((endAt - now) / 1000))
  const done = left === 0
  return (
    <div className={`rest-timer ${done ? 'rest-done' : ''}`} role="timer" aria-live={done ? 'assertive' : 'off'}>
      <span className="rest-label">{done ? 'Repos terminé — c’est reparti !' : 'Repos'}</span>
      <span className="rest-time">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
      <div className="row-wrap center">
        <button className="btn btn-sm" onClick={() => onChange(Math.max(Date.now(), endAt - 15000))}>−15 s</button>
        <button className="btn btn-sm" onClick={() => onChange(Math.max(Date.now(), endAt) + 15000)}>+15 s</button>
        <button className="btn btn-sm" onClick={() => onChange(null)}>{done ? 'OK' : 'Passer'}</button>
      </div>
    </div>
  )
}

export function WorkoutPage() {
  const { id = '' } = useParams()
  const toast = useToast()
  const [workout, setWorkout] = useState<WorkoutLog | null>(null)
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const settings = useLiveQuery(() => db.settings.get('main'))
  useWakeLock()

  useEffect(() => {
    repo.startOrResumeWorkout(id).then(setWorkout).catch((e) => toast(errorMessage(e), 'error'))
  }, [id, toast])

  if (!workout || !session || !settings) return <div className="page"><Loading /></div>
  if (!session.templateId) return <div className="page"><p>Séance sans contenu.</p><Link to="/calendrier">← Calendrier</Link></div>
  return <Workout workout={workout} settings={settings} slotsBase={buildSession(session.templateId, session.environment ?? 'home', equipmentFor(settings, session.environment ?? 'home'), session.light)} sessionId={id} />
}

function Workout({ workout, settings, slotsBase, sessionId }: { workout: WorkoutLog; settings: Settings; slotsBase: ResolvedSlot[]; sessionId: string }) {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const env = workout.environment ?? 'home'
  const equipment = equipmentFor(settings, env)
  const [overrides, setOverrides] = useState<Record<number, string>>(() => loadOverrides(workout.id))
  const slots = useMemo(
    () => slotsBase.map((s, i) => (overrides[i] ? { ...s, exercise: getExercise(overrides[i]), substituted: true } : s)),
    [slotsBase, overrides],
  )
  const sets = useLiveQuery(() => db.sets.where('workoutLogId').equals(workout.id).sortBy('loggedAt'), [workout.id])
  const countFor = (i: number) => (sets ?? []).filter((s) => s.exerciseId === slots[i].exercise.id).length
  const firstIncomplete = slots.findIndex((_, i) => countFor(i) < slots[i].sets)
  const [idx, setIdx] = useState<number | null>(null)
  const current = idx ?? (firstIncomplete === -1 ? slots.length - 1 : firstIncomplete)
  const slot = slots[current]
  const ex = slot.exercise
  const doneSets = (sets ?? []).filter((s) => s.exerciseId === ex.id)
  const [restEnd, setRestEnd] = useState<number | null>(null)
  const [showCues, setShowCues] = useState(false)
  const [showSwap, setShowSwap] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const [history, setHistory] = useState<SessionSets[] | null>(null)
  useEffect(() => {
    setHistory(null)
    repo.exerciseHistory(ex.id, workout.id).then(setHistory)
  }, [ex.id, workout.id])

  const increment = ex.equipment.includes('barbell') ? settings.barbellIncrementKg : ex.equipment.includes('backpack') ? 1 : settings.dumbbellIncrementKg
  const suggestion: Suggestion | null = history
    ? suggestNext({ exercise: ex, reps: slot.reps, durationSec: slot.durationSec, sets: slot.sets, history, incrementKg: increment })
    : null

  // Valeurs de saisie, pré-remplies par la suggestion
  const [reps, setReps] = useState<number | ''>('')
  const [load, setLoad] = useState<number | ''>('')
  const [dur, setDur] = useState<number | ''>('')
  const [rir, setRir] = useState<number | null>(null)
  const [quality, setQuality] = useState<number | null>(null)
  const prefillKey = `${ex.id}-${doneSets.length}-${suggestion ? 1 : 0}`
  const lastPrefill = useRef('')
  useEffect(() => {
    if (!suggestion || lastPrefill.current === prefillKey) return
    lastPrefill.current = prefillKey
    const prev = doneSets[doneSets.length - 1]
    setReps(prev?.reps ?? suggestion.targetReps[doneSets.length] ?? suggestion.targetReps.at(-1) ?? slot.reps?.[0] ?? '')
    setLoad(prev?.loadKg ?? suggestion.loadKg ?? '')
    setDur(prev?.durationSec ?? suggestion.targetDurationSec ?? slot.durationSec ?? '')
    setRir(null)
    setQuality(null)
  }, [prefillKey, suggestion, doneSets, slot])

  const tracking = ex.tracking
  const isMobility = ex.category === 'mobilite'
  const isPower = ex.category === 'explosivite'

  const validate = async () => {
    try {
      await repo.logSet({
        workoutLogId: workout.id, exerciseId: ex.id, setIndex: doneSets.length,
        reps: tracking !== 'time' && reps !== '' ? reps : undefined,
        loadKg: tracking === 'load' && load !== '' ? load : undefined,
        durationSec: tracking === 'time' && dur !== '' ? dur : undefined,
        rir: rir ?? undefined,
        quality: quality ?? undefined,
      })
      const finishedExercise = doneSets.length + 1 >= slot.sets
      if (slot.restSec > 0 && !(finishedExercise && current === slots.length - 1)) setRestEnd(Date.now() + slot.restSec * 1000)
      if (finishedExercise) setIdx(null)
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const swap = (newId: string) => {
    const o = { ...overrides, [current]: newId }
    setOverrides(o)
    saveOverrides(workout.id, o)
    setShowSwap(false)
  }

  const totalPlanned = slots.reduce((a, s) => a + s.sets, 0)
  const totalDone = slots.reduce((a, _, i) => a + Math.min(countFor(i), slots[i].sets), 0)

  return (
    <div className="page workout">
      <header className="workout-head">
        <Link to={`/seance/${sessionId}`} className="back">← Séance</Link>
        <div className="progress-bar" aria-label={`${totalDone} séries sur ${totalPlanned}`}><span style={{ width: `${(totalDone / totalPlanned) * 100}%` }} /></div>
        <span className="small muted">{totalDone}/{totalPlanned} séries</span>
      </header>

      <div className="ex-nav">
        <button className="icon-btn" disabled={current === 0} onClick={() => setIdx(current - 1)} aria-label="Exercice précédent">◀</button>
        <div className="ex-title">
          <span className="small muted">Exercice {current + 1}/{slots.length}</span>
          <h1>{ex.name}</h1>
        </div>
        <button className="icon-btn" disabled={current === slots.length - 1} onClick={() => setIdx(current + 1)} aria-label="Exercice suivant">▶</button>
      </div>

      <p className="prescription">
        {slot.sets} séries × {slot.reps ? (slot.reps[0] === slot.reps[1] ? slot.reps[0] : `${slot.reps[0]}–${slot.reps[1]}`) : `${slot.durationSec} s`}
        {slot.rirTarget && ` · garder ${slot.rirTarget[0]}–${slot.rirTarget[1]} rép. en réserve`}
        {slot.note && ` · ${slot.note}`}
      </p>
      {suggestion && <div className={`suggestion sg-${suggestion.kind}`}>💡 {suggestion.message}</div>}

      <div className="row-wrap">
        <button className="btn btn-ghost btn-sm" onClick={() => setShowCues((v) => !v)}>{showCues ? 'Masquer' : 'Voir'} les consignes</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowSwap(true)}>⇄ Remplacer</button>
      </div>
      {showCues && (
        <div className="card small">
          <p>{ex.description}</p>
          <ul>{ex.cues.map((c) => <li key={c}>{c}</li>)}</ul>
          {ex.precautions && <p className="warn-text">⚠️ {ex.precautions}</p>}
        </div>
      )}

      <ul className="done-sets">
        {doneSets.map((s, i) => (
          <li key={s.id}>
            <span>Série {i + 1}</span>
            <span>
              {s.reps !== undefined && `${s.reps} rép.`}
              {s.loadKg !== undefined && ` × ${s.loadKg} kg`}
              {s.durationSec !== undefined && `${s.durationSec} s`}
              {s.rir !== undefined && ` · RIR ${s.rir}`}
              {s.quality !== undefined && ` · qualité ${s.quality}/5`}
            </span>
            <button className="icon-btn small" aria-label={`Supprimer la série ${i + 1}`} onClick={() => repo.deleteSet(s.id)}>✕</button>
          </li>
        ))}
      </ul>

      <RestTimer endAt={restEnd} onChange={setRestEnd} />

      {doneSets.length < slot.sets || idx !== null ? (
        <div className="set-input card">
          <h2>Série {doneSets.length + 1}{doneSets.length >= slot.sets ? ' (bonus)' : ''}</h2>
          <div className="inputs">
            {tracking === 'time'
              ? <Stepper label="Durée" suffix="s" value={dur} onChange={setDur} step={5} max={600} />
              : <Stepper label="Répétitions" value={reps} onChange={setReps} max={100} />}
            {tracking === 'load' && <Stepper label="Charge" suffix="kg" value={load} onChange={setLoad} step={increment >= 1 ? 1 : 0.5} max={400} />}
          </div>
          {!isMobility && !isPower && tracking !== 'time' && (
            <div className="field">
              <span>Répétitions en réserve (RIR)</span>
              <div className="seg seg-sm">
                {[0, 1, 2, 3, 4].map((v) => <button key={v} className={rir === v ? 'on' : ''} onClick={() => setRir(rir === v ? null : v)}>{v === 4 ? '4+' : v}</button>)}
              </div>
              <span className="hint">0 = impossible d’en faire une de plus</span>
            </div>
          )}
          {isPower && (
            <div className="field">
              <span>Qualité technique / vitesse</span>
              <div className="seg seg-sm">
                {[1, 2, 3, 4, 5].map((v) => <button key={v} className={quality === v ? 'on' : ''} onClick={() => setQuality(quality === v ? null : v)}>{v}</button>)}
              </div>
              <span className="hint">Si la qualité baisse nettement, arrête l’exercice : c’est normal.</span>
            </div>
          )}
          <button className="btn btn-primary btn-lg btn-block" onClick={validate}>✓ Valider la série</button>
        </div>
      ) : (
        <div className="callout callout-ok">
          Exercice terminé.{' '}
          {current < slots.length - 1
            ? <button className="btn btn-primary" onClick={() => setIdx(current + 1)}>Exercice suivant ▶</button>
            : <strong>Dernier exercice fait, tu peux terminer la séance.</strong>}
        </div>
      )}

      <details className="overview">
        <summary>Programme de la séance</summary>
        <ol>
          {slots.map((s, i) => (
            <li key={i}>
              <button className={`link ${i === current ? 'is-current' : ''}`} onClick={() => setIdx(i)}>
                {s.exercise.name} — {countFor(i)}/{s.sets} {countFor(i) >= s.sets ? '✓' : ''}
              </button>
            </li>
          ))}
        </ol>
      </details>

      <div className="row-wrap mt">
        <button className="btn btn-primary" onClick={() => setFinishing(true)}>Terminer la séance</button>
        <button className="btn btn-ghost" onClick={async () => {
          if (await confirm({ title: 'Arrêter la séance ?', message: 'Les séries déjà validées sont conservées. La séance sera marquée « partielle ».', confirmLabel: 'Arrêter' })) {
            await repo.finishWorkout(workout.id, totalDone > 0 ? 'partial' : 'abandoned')
            navigate(`/seance/${sessionId}`)
          }
        }}>Arrêter</button>
      </div>

      {showSwap && (
        <Modal title="Remplacer l’exercice" onClose={() => setShowSwap(false)}>
          {(() => {
            const base = slotsBase[current].exercise.id
            const options = [slotsBase[current].exercise, ...substitutesFor(base, equipment), ...substitutesFor(ex.id, equipment)]
              .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i && e.id !== ex.id)
            return options.length ? (
              <ul className="swap-list">
                {options.map((o) => (
                  <li key={o.id}><button className="btn btn-block" onClick={() => swap(o.id)}>{o.name}<span className="small muted"> — {o.primaryMuscles}</span></button></li>
                ))}
              </ul>
            ) : <p>Aucun remplacement disponible avec ton matériel.</p>
          })()}
        </Modal>
      )}

      {finishing && <FinishDialog onClose={() => setFinishing(false)} complete={totalDone >= totalPlanned} onFinish={async (feeling, notes) => {
        await repo.finishWorkout(workout.id, totalDone >= totalPlanned ? 'done' : 'partial', feeling, notes)
        try { localStorage.removeItem(overridesKey(workout.id)) } catch { /* ignore */ }
        toast('Séance enregistrée 💪')
        navigate(`/seance/${sessionId}`)
      }} />}
    </div>
  )
}

function FinishDialog({ onClose, onFinish, complete }: { onClose: () => void; onFinish: (feeling: number, notes: string) => void; complete: boolean }) {
  const [feeling, setFeeling] = useState(6)
  const [notes, setNotes] = useState('')
  return (
    <Modal title="Terminer la séance" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Continuer</button><button className="btn btn-primary" onClick={() => onFinish(feeling, notes)}>Enregistrer</button></>}>
      <p>{complete ? 'Toutes les séries prévues sont faites.' : 'Certaines séries ne sont pas faites : la séance sera marquée « partielle ».'}</p>
      <label className="field">
        <span>Difficulté ressentie de la séance : <strong>{feeling}/10</strong></span>
        <input type="range" min={1} max={10} value={feeling} onChange={(e) => setFeeling(Number(e.target.value))} />
      </label>
      <label className="field">
        <span>Notes</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
    </Modal>
  )
}
