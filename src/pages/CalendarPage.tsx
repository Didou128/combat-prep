import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { addDays, DAY_NAMES, dayIndex, formatShort, todayISO, weekDates, weekStartOf, isValidISODate, timeToMinutes } from '../domain/dates'
import { analyzeSessions, type Warning } from '../domain/conflicts'
import type { DayIndex, PlannedSession } from '../domain/types'
import * as repo from '../db/repo'
import { errorMessage, formatDuration, Loading, sessionMeta, StatusBadge, useConfirm, useToast } from '../ui/common'
import { SessionEditor } from '../ui/SessionEditor'

export function SessionCard({ s, warnings, onOpen, draggable }: { s: PlannedSession; warnings: Warning[]; onOpen: () => void; draggable?: boolean }) {
  const m = sessionMeta(s)
  const w = warnings.filter((x) => x.sessionIds.includes(s.id) && x.level !== 'info')
  return (
    <button
      className={`session-card cat-${m.category} status-${s.status}`}
      onClick={onOpen}
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move' }}
      aria-label={`${m.label}, ${s.startTime}, ${formatDuration(s.durationMin)}`}
    >
      <span className="sc-title">{m.icon} {s.kind === 'prep' && s.templateId ? `${s.templateId} · ${m.label.split('—')[1]?.trim() ?? m.label}` : m.label}</span>
      <span className="sc-meta">
        {s.startTime} · {formatDuration(s.durationMin)}
        {s.environment && (s.kind === 'prep') && <> · {s.environment === 'gym' ? 'Salle' : 'Domicile'}</>}
        {s.light && <> · allégée</>}
      </span>
      <span className="sc-foot">
        <StatusBadge status={s.status} />
        {w.length > 0 && <span className="warn-dot" title={w.map((x) => x.message).join('\n')}>⚠️</span>}
      </span>
    </button>
  )
}

export function CalendarPage() {
  const [params, setParams] = useSearchParams()
  const confirm = useConfirm()
  const toast = useToast()
  const paramWeek = params.get('semaine')
  const weekStart = paramWeek && isValidISODate(paramWeek) ? weekStartOf(paramWeek) : weekStartOf(todayISO())
  const [ready, setReady] = useState(false)
  const [editing, setEditing] = useState<{ session?: PlannedSession; date?: string } | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [dragOver, setDragOver] = useState<string | null>(null)

  useEffect(() => {
    setReady(false)
    setNotes([])
    repo.ensureWeek(weekStart).then(() => setReady(true)).catch((e) => toast(errorMessage(e), 'error'))
  }, [weekStart, toast])

  const range = useLiveQuery(() => repo.listRange(addDays(weekStart, -1), addDays(weekStart, 7)), [weekStart])
  const dates = weekDates(weekStart)
  const warnings = useMemo(() => (range ? analyzeSessions(range) : []), [range])
  const weekWarnings = warnings.filter((w) => w.date >= addDays(weekStart, -1) && w.date <= addDays(weekStart, 6))
  const week = (range ?? []).filter((s) => s.date >= weekStart && s.date <= dates[6])
  const kick = week.find((s) => s.kind === 'kickboxing' && s.status !== 'cancelled')

  const goWeek = (delta: number) => setParams({ semaine: addDays(weekStart, delta * 7) })

  const generate = async () => {
    const n = await repo.sessionsReplacedByGeneration(weekStart)
    if (n > 0) {
      const ok = await confirm({
        title: 'Régénérer la semaine ?',
        message: `${n} séance(s) générée(s) et non commencée(s) seront remplacées. Les séances ajoutées à la main, effectuées ou annulées sont conservées.`,
        confirmLabel: 'Régénérer',
      })
      if (!ok) return
    }
    try {
      const res = await repo.generateWeek(weekStart)
      setNotes(res.notes)
      toast(`${res.prep.length} séance(s) de préparation proposée(s). Tout reste modifiable.`)
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const copyPrev = async () => {
    const n = await repo.sessionsReplacedByCopy(weekStart)
    const ok = await confirm({
      title: 'Copier la semaine précédente ?',
      message: n
        ? `Les ${n} séance(s) encore « prévues » de cette semaine seront remplacées par celles de la semaine précédente. Les séances effectuées sont conservées.`
        : 'Les séances de la semaine précédente seront copiées ici avec le statut « prévue ».',
      confirmLabel: 'Copier',
    })
    if (!ok) return
    try {
      const c = await repo.copyPreviousWeek(weekStart)
      toast(`${c} séance(s) copiée(s)`)
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const changeKick = async (v: string) => {
    try {
      await repo.setKickDayForWeek(weekStart, Number(v) as DayIndex)
      const hasGenerated = await repo.sessionsReplacedByGeneration(weekStart)
      if (hasGenerated) {
        const ok = await confirm({
          title: 'Kick-boxing déplacé',
          message: 'Veux-tu réorganiser la préparation physique de la semaine autour du nouveau jour ?',
          confirmLabel: 'Réorganiser',
        })
        if (ok) {
          const res = await repo.generateWeek(weekStart)
          setNotes(res.notes)
        }
      }
      toast('Jour du kick-boxing modifié pour cette semaine uniquement')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const onDrop = async (date: string, e: DragEvent) => {
    e.preventDefault()
    setDragOver(null)
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    try {
      await repo.moveSession(id, date)
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const today = todayISO()

  return (
    <div className="page">
      <header className="page-head">
        <div className="week-nav">
          <button className="icon-btn" onClick={() => goWeek(-1)} aria-label="Semaine précédente">◀</button>
          <h1>Semaine du {formatShort(weekStart)} au {formatShort(dates[6])}</h1>
          <button className="icon-btn" onClick={() => goWeek(1)} aria-label="Semaine suivante">▶</button>
          {weekStart !== weekStartOf(today) && <button className="btn btn-ghost btn-sm" onClick={() => setParams({})}>Aujourd’hui</button>}
        </div>
        <div className="toolbar">
          <label className="inline-field">
            <span>🥊 Kick-boxing cette semaine</span>
            <select value={kick ? dayIndex(kick.date) : ''} onChange={(e) => changeKick(e.target.value)} disabled={!ready}>
              {!kick && <option value="">— aucun —</option>}
              {DAY_NAMES.slice(0, 6).map((n, i) => <option key={n} value={i}>{n}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={generate} disabled={!ready}>✨ Générer ma semaine</button>
          <button className="btn" onClick={copyPrev} disabled={!ready}>⧉ Copier la semaine précédente</button>
          <button className="btn" onClick={() => setEditing({ date: weekStart <= today && today <= dates[6] ? today : weekStart })}>＋ Ajouter</button>
        </div>
      </header>

      {notes.length > 0 && (
        <div className="callout callout-info">
          {notes.map((n) => <p key={n}>{n}</p>)}
        </div>
      )}
      {weekWarnings.length > 0 && (
        <details className="callout callout-warn" open={weekWarnings.some((w) => w.level === 'error')}>
          <summary>⚠️ {weekWarnings.length} point(s) d’attention sur la récupération</summary>
          <ul>{weekWarnings.map((w, i) => <li key={i} className={`w-${w.level}`}>{formatShort(w.date)} — {w.message}</li>)}</ul>
        </details>
      )}

      {!range || !ready ? <Loading /> : (
        <div className="week-grid">
          {dates.map((date, i) => {
            const items = week.filter((s) => s.date === date).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
            const active = items.filter((s) => s.status !== 'cancelled')
            return (
              <section
                key={date}
                className={`day-col ${date === today ? 'is-today' : ''} ${dragOver === date ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(date) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => onDrop(date, e)}
                aria-label={`${DAY_NAMES[i]} ${formatShort(date)}`}
              >
                <header className="day-head">
                  <span className="day-name">{DAY_NAMES[i]}</span>
                  <span className="day-date">{formatShort(date)}</span>
                </header>
                <div className="day-body">
                  {items.map((s) => (
                    <SessionCard key={s.id} s={s} warnings={warnings} draggable onOpen={() => setEditing({ session: s })} />
                  ))}
                  {active.length === 0 && <div className="rest-day">😴 Repos</div>}
                  <button className="add-in-day" onClick={() => setEditing({ date })} aria-label={`Ajouter une séance ${DAY_NAMES[i]}`}>＋</button>
                </div>
              </section>
            )
          })}
        </div>
      )}
      <p className="legend">
        <span className="lg cat-combat">Combat</span>
        <span className="lg cat-force">Force</span>
        <span className="lg cat-explosivite">Explosivité</span>
        <span className="lg cat-mobilite">Mobilité</span>
        <span className="lg cat-repos">Repos</span>
        <span className="muted">Sur ordinateur, glisse une séance vers un autre jour. Sur iPhone, touche-la puis choisis le jour.</span>
      </p>

      {editing && <SessionEditor session={editing.session} defaultDate={editing.date} onClose={() => setEditing(null)} />}
    </div>
  )
}
