import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import * as repo from '../db/repo'
import { addDays, todayISO } from '../domain/dates'
import { assessRecovery, LEVEL_LABELS, type RecoveryAssessment } from '../domain/recovery'
import type { RecoveryCheckin } from '../domain/types'
import { errorMessage, Stepper, useToast } from './common'

type Scale = 'sleepQuality' | 'energy' | 'fatigue' | 'soreness' | 'motivation'

const SCALES: { key: Scale; label: string; low: string; high: string }[] = [
  { key: 'sleepQuality', label: 'Qualité du sommeil', low: 'très mauvaise', high: 'excellente' },
  { key: 'energy', label: 'Énergie', low: 'vidé', high: 'en pleine forme' },
  { key: 'fatigue', label: 'Fatigue', low: 'aucune', high: 'épuisé' },
  { key: 'soreness', label: 'Courbatures', low: 'aucune', high: 'très fortes' },
  { key: 'motivation', label: 'Motivation', low: 'aucune', high: 'à fond' },
]

/** Point du jour et évaluation (avec les 2 jours précédents pour repérer une fatigue qui dure). */
export function useRecovery(date = todayISO()) {
  return useLiveQuery(async () => {
    const list = await repo.listCheckins(addDays(date, -2), date)
    const today = list.find((c) => c.date === date)
    return { checkin: today, assessment: today ? assessRecovery(today, list.filter((c) => c.date !== date)) : undefined }
  }, [date])
}

export function CheckinForm({ date, initial, onDone }: { date: string; initial?: RecoveryCheckin; onDone: () => void }) {
  const toast = useToast()
  const [sleep, setSleep] = useState<number | ''>(initial?.sleepHours ?? 7.5)
  const [values, setValues] = useState<Record<Scale, number | null>>({
    sleepQuality: initial?.sleepQuality ?? null, energy: initial?.energy ?? null, fatigue: initial?.fatigue ?? null,
    soreness: initial?.soreness ?? null, motivation: initial?.motivation ?? null,
  })
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const missing = SCALES.filter((s) => values[s.key] === null)

  const save = async () => {
    if (sleep === '' || missing.length) {
      toast(`À renseigner : ${[sleep === '' ? 'sommeil' : '', ...missing.map((m) => m.label.toLowerCase())].filter(Boolean).join(', ')}.`, 'error')
      return
    }
    try {
      await repo.saveCheckin({ date, sleepHours: sleep, ...(values as Record<Scale, number>), notes: notes.trim() || undefined })
      toast('Point de récupération enregistré')
      onDone()
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  return (
    <div className="checkin-form">
      <Stepper label="Heures de sommeil" suffix="h" value={sleep} onChange={setSleep} step={0.5} min={0} max={16} />
      {SCALES.map((s) => (
        <div key={s.key} className="field">
          <span>{s.label}</span>
          <div className="seg seg-sm" role="group" aria-label={s.label}>
            {[1, 2, 3, 4, 5].map((v) => (
              <button key={v} type="button" className={values[s.key] === v ? 'on' : ''} aria-pressed={values[s.key] === v}
                onClick={() => setValues((x) => ({ ...x, [s.key]: v }))}>{v}</button>
            ))}
          </div>
          <span className="hint">1 = {s.low} · 5 = {s.high}</span>
        </div>
      ))}
      <label className="field">
        <span>Notes (facultatif)</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex. : genou gauche sensible, grosse journée de travail…" />
      </label>
      <div className="row-wrap">
        <button className="btn btn-primary" onClick={save}>Enregistrer</button>
        <button className="btn btn-ghost" onClick={onDone}>Annuler</button>
      </div>
    </div>
  )
}

export function RecoveryAdvice({ a, compact }: { a: RecoveryAssessment; compact?: boolean }) {
  const icon = a.level === 'bon' ? '🟢' : a.level === 'moyen' ? '🟠' : '🔴'
  return (
    <div className={`recovery-advice rl-${a.level}`}>
      <p><strong>{icon} {LEVEL_LABELS[a.level]}</strong> <span className="muted">· score {a.score}/100</span></p>
      {a.reasons.length > 0 && <p className="small muted">À noter : {a.reasons.join(', ')}.</p>}
      <ul>{(compact ? a.suggestions.slice(0, 2) : a.suggestions).map((s) => <li key={s}>{s}</li>)}</ul>
      <p className="hint">Suggestions indicatives, basées sur ta saisie : écoute tes sensations. Elles ne remplacent pas l’avis d’un professionnel de santé.</p>
    </div>
  )
}

/** Carte « Récupération du jour » (accueil et page Progrès). */
export function RecoveryCard({ date = todayISO() }: { date?: string }) {
  const data = useRecovery(date)
  const [editing, setEditing] = useState(false)
  if (!data) return null
  return (
    <section className="card" aria-label="Récupération du jour">
      <div className="card-head">
        <h2>Récupération du jour</h2>
        {data.checkin && !editing && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Modifier</button>}
      </div>
      {editing ? (
        <CheckinForm date={date} initial={data.checkin} onDone={() => setEditing(false)} />
      ) : data.assessment ? (
        <RecoveryAdvice a={data.assessment} />
      ) : (
        <>
          <p className="muted">Sommeil, énergie, fatigue, courbatures, motivation : 30 secondes pour adapter ta séance.</p>
          <button className="btn btn-primary" onClick={() => setEditing(true)}>Faire le point</button>
        </>
      )}
    </section>
  )
}

/** Rappel sur la page d'une séance du jour quand la récupération n'est pas bonne. */
export function SessionRecoveryHint({ date }: { date: string }) {
  const data = useRecovery(date)
  if (!data?.assessment || data.assessment.level === 'bon') return null
  return (
    <div className="callout callout-warn">
      <RecoveryAdvice a={data.assessment} compact />
    </div>
  )
}
