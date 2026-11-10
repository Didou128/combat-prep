import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router-dom'
import { db } from '../db/db'
import * as repo from '../db/repo'
import { addDays, formatLong, formatShort, todayISO } from '../domain/dates'
import { getExercise } from '../domain/exercises'
import { assessRecovery, LEVEL_LABELS } from '../domain/recovery'
import { exercisesWithLoad, lastWeeks, loadProgress, weeklyAdherence, weeklyVolume } from '../domain/stats'
import type { SetLog } from '../domain/types'
import { CHART_COLORS, ColumnChart, DataTable, LineChart } from '../ui/charts'
import { Loading, sessionMeta, StatusBadge } from '../ui/common'
import { RecoveryCard } from '../ui/Recovery'

const TABS = [
  { id: 'graphiques', label: '📈 Graphiques' },
  { id: 'historique', label: '🗂️ Historique' },
  { id: 'recuperation', label: '😴 Récupération' },
] as const
type Tab = (typeof TABS)[number]['id']

export function ProgressPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = (TABS.find((t) => t.id === params.get('vue'))?.id) ?? 'graphiques'
  return (
    <div className="page">
      <h1>Progrès</h1>
      <div className="seg mb" role="tablist" aria-label="Vue">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setParams({ vue: t.id })}>{t.label}</button>
        ))}
      </div>
      {tab === 'graphiques' && <Charts />}
      {tab === 'historique' && <History />}
      {tab === 'recuperation' && <RecoveryTab />}
    </div>
  )
}

// ---------- Graphiques ----------

function Charts() {
  const [nWeeks, setNWeeks] = useState(8)
  const today = todayISO()
  const weeks = lastWeeks(nWeeks, today)
  const data = useLiveQuery(async () => ({
    sets: await db.sets.toArray(),
    sessions: await repo.listRange(weeks[0], addDays(weeks[weeks.length - 1], 6)),
  }), [weeks[0], today])
  if (!data) return <Loading />
  const labels = weeks.map(formatShort)

  return (
    <>
      <div className="row-wrap mb">
        <span className="small muted">Période :</span>
        <div className="seg seg-sm" role="group" aria-label="Période">
          {[4, 8, 12, 26].map((n) => <button key={n} className={nWeeks === n ? 'on' : ''} onClick={() => setNWeeks(n)}>{n} sem.</button>)}
        </div>
      </div>
      <LoadChart sets={data.sets} />
      <VolumeChart sets={data.sets} weeks={weeks} labels={labels} />
      <AdherenceChart sessions={data.sessions} weeks={weeks} labels={labels} today={today} />
    </>
  )
}

function LoadChart({ sets }: { sets: SetLog[] }) {
  const options = exercisesWithLoad(sets)
  const [chosen, setChosen] = useState<string | null>(null)
  const exId = chosen && options.some((o) => o.id === chosen) ? chosen : options[0]?.id
  const points = exId ? loadProgress(exId, sets) : []
  return (
    <section className="card">
      <h2>Charges</h2>
      {!options.length ? (
        <p className="muted">Aucune série avec charge enregistrée pour l’instant. Les courbes apparaîtront après tes premières séances en mode entraînement.</p>
      ) : (
        <>
          <label className="inline-field mb">
            <span>Exercice</span>
            <select value={exId} onChange={(e) => setChosen(e.target.value)}>
              {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <p className="small muted">Meilleure charge de chaque séance (kg).{points.length < 2 && ' Une seule séance pour l’instant : la courbe se dessinera à la suivante.'}</p>
          <LineChart
            ariaLabel={`Meilleure charge par séance — ${getExercise(exId!).name}`}
            unit="kg"
            points={points.map((p) => ({
              label: formatShort(p.date), value: p.bestLoadKg,
              tooltip: <><strong>{formatLong(p.date)}</strong><br />{p.bestLoadKg} kg × {p.repsAtBest} rép.<br />{p.sets} série(s){p.e1rmKg && <><br />1RM estimé ≈ {p.e1rmKg} kg</>}</>,
            }))}
          />
          <DataTable head={['Date', 'Meilleure série', 'Séries', '1RM estimé']} rows={[...points].reverse().map((p) => [
            formatShort(p.date), `${p.bestLoadKg} kg × ${p.repsAtBest}`, p.sets, p.e1rmKg ? `${p.e1rmKg} kg` : '—',
          ])} />
          <p className="hint">1RM estimé (formule d’Epley) : ordre de grandeur seulement, affiché pour les séries de 12 répétitions ou moins. Ne cherche pas à le tester.</p>
        </>
      )}
    </section>
  )
}

function VolumeChart({ sets, weeks, labels }: { sets: SetLog[]; weeks: string[]; labels: string[] }) {
  const vol = weeklyVolume(sets, weeks)
  const empty = vol.every((v) => v.workSets === 0)
  return (
    <section className="card">
      <h2>Volume par semaine</h2>
      {empty ? <p className="muted">Aucune série enregistrée sur la période.</p> : (
        <>
          <p className="small muted">Nombre de séries de travail (hors mobilité).</p>
          <ColumnChart
            ariaLabel="Séries de travail par semaine" labels={labels}
            series={[{ name: 'Séries', color: CHART_COLORS.blue, values: vol.map((v) => v.workSets) }]}
            tooltip={(i) => <><strong>Semaine du {labels[i]}</strong><br />{vol[i].workSets} série(s)<br />Tonnage : {vol[i].tonnageKg.toLocaleString('fr-FR')} kg</>}
          />
          <DataTable head={['Semaine du', 'Séries', 'Tonnage (kg)']} rows={vol.map((v, i) => [labels[i], v.workSets, v.tonnageKg.toLocaleString('fr-FR')])} />
        </>
      )}
    </section>
  )
}

function AdherenceChart({ sessions, weeks, labels, today }: { sessions: Parameters<typeof weeklyAdherence>[0]; weeks: string[]; labels: string[]; today: string }) {
  const adh = weeklyAdherence(sessions, weeks, today)
  const totals = adh.reduce((a, w) => ({ due: a.due + w.due, done: a.done + w.done + w.partial }), { due: 0, done: 0 })
  return (
    <section className="card">
      <h2>Assiduité — préparation physique</h2>
      {totals.due === 0 ? <p className="muted">Aucune séance de préparation passée sur la période.</p> : (
        <>
          <p className="small muted">
            {totals.done} séance(s) faites ou partielles sur {totals.due} prévues ({Math.round((totals.done / totals.due) * 100)} %).
          </p>
          <ColumnChart
            ariaLabel="Séances de préparation par semaine : faites, partielles, manquées" labels={labels}
            series={[
              { name: 'Faites', color: CHART_COLORS.blue, values: adh.map((w) => w.done) },
              { name: 'Partielles', color: CHART_COLORS.orange, values: adh.map((w) => w.partial) },
              { name: 'Manquées', color: CHART_COLORS.gray, values: adh.map((w) => w.missed) },
            ]}
            tooltip={(i) => <><strong>Semaine du {labels[i]}</strong><br />Faites : {adh[i].done}<br />Partielles : {adh[i].partial}<br />Manquées : {adh[i].missed}<br />Combats faits : {adh[i].combatDone}</>}
          />
          <DataTable head={['Semaine du', 'Prévues', 'Faites', 'Partielles', 'Manquées', 'Combats']} rows={adh.map((w, i) => [labels[i], w.due, w.done, w.partial, w.missed, w.combatDone])} />
        </>
      )}
    </section>
  )
}

// ---------- Historique ----------

function History() {
  const [limit, setLimit] = useState(20)
  const data = useLiveQuery(() => repo.listHistory(limit), [limit])
  if (!data) return <Loading />
  if (!data.entries.length) return <p className="muted">Aucune séance passée pour l’instant.</p>
  return (
    <>
      <ul className="history-list">
        {data.entries.map(({ session, workouts, sets, combat }) => {
          const m = sessionMeta(session)
          const byEx = new Map<string, SetLog[]>()
          for (const s of sets) byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), s])
          const feeling = workouts.find((w) => w.feeling !== undefined)?.feeling
          const wNotes = workouts.map((w) => w.notes).filter(Boolean)
          return (
            <li key={session.id} className={`history-item cat-${m.category}`}>
              <div className="card-head">
                <Link to={`/seance/${session.id}`}><strong>{m.icon} {m.label}</strong></Link>
                <span className="small muted">{formatLong(session.date)}</span>
              </div>
              <div className="row-wrap small">
                {session.status === 'planned' ? <span className="badge badge-cancelled">Non renseignée</span> : <StatusBadge status={session.status} />}
                {session.environment && session.kind === 'prep' && <span className="muted">{session.environment === 'gym' ? 'Salle' : 'Domicile'}</span>}
                {session.light && <span className="muted">version allégée</span>}
                {feeling !== undefined && <span className="muted">difficulté {feeling}/10</span>}
              </div>
              {byEx.size > 0 && (
                <ul className="history-sets small">
                  {[...byEx].map(([exId, list]) => (
                    <li key={exId}>
                      <span>{exName(exId)}</span>
                      <span className="muted">{list.map(formatSet).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              )}
              {combat && <p className="small">Durée {combat.durationMin} min · intensité {combat.intensity}/10 · fatigue {combat.fatigueAfter}/10</p>}
              {[...wNotes, combat?.notes, session.notes].filter(Boolean).map((n, i) => <p key={i} className="small muted history-note">{n}</p>)}
            </li>
          )
        })}
      </ul>
      {data.hasMore && <button className="btn btn-block" onClick={() => setLimit((l) => l + 20)}>Afficher plus</button>}
    </>
  )
}

const exName = (id: string) => { try { return getExercise(id).name } catch { return id } }
function formatSet(s: SetLog) {
  if (s.durationSec !== undefined) return `${s.durationSec} s`
  const base = s.loadKg !== undefined ? `${s.reps ?? '?'}×${String(s.loadKg).replace('.', ',')} kg` : `${s.reps ?? '?'} rép.`
  return s.rir !== undefined ? `${base} (RIR ${s.rir})` : base
}

// ---------- Récupération ----------

function RecoveryTab() {
  const today = todayISO()
  const from = addDays(today, -29)
  const list = useLiveQuery(() => repo.listCheckins(addDays(from, -2), today), [today])
  if (!list) return <Loading />
  const shown = list.filter((c) => c.date >= from)
  const assessed = shown.map((c) => ({ c, a: assessRecovery(c, list.filter((p) => p.date < c.date)) }))
  return (
    <>
      <RecoveryCard date={today} />
      <section className="card">
        <h2>Score de récupération — 30 derniers jours</h2>
        {shown.length === 0 ? <p className="muted">Aucun point de récupération sur les 30 derniers jours.</p> : (
          <>
            <p className="small muted">Les jours sans saisie ne sont pas affichés (aucune valeur inventée).</p>
            <LineChart
              ariaLabel="Score de récupération par jour" unit=""
              points={assessed.map(({ c, a }) => ({
                label: formatShort(c.date), value: a.score,
                tooltip: <><strong>{formatLong(c.date)}</strong><br />{LEVEL_LABELS[a.level]} ({a.score}/100)<br />Sommeil {c.sleepHours} h · énergie {c.energy}/5<br />Fatigue {c.fatigue}/5 · courbatures {c.soreness}/5<br />Motivation {c.motivation}/5</>,
              }))}
            />
            <DataTable
              head={['Date', 'Score', 'Sommeil', 'Qualité', 'Énergie', 'Fatigue', 'Courbatures', 'Motivation']}
              rows={[...assessed].reverse().map(({ c, a }) => [formatShort(c.date), a.score, `${c.sleepHours} h`, c.sleepQuality, c.energy, c.fatigue, c.soreness, c.motivation])}
            />
          </>
        )}
      </section>
    </>
  )
}
