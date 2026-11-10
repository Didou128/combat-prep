import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import * as repo from '../db/repo'
import { addDays, DAY_SHORT, formatLong, timeToMinutes, todayISO, weekDates, weekStartOf } from '../domain/dates'
import { errorMessage, formatDuration, Loading, sessionMeta, useToast } from '../ui/common'
import { RecoveryCard } from '../ui/Recovery'
import { MissedSessions } from '../ui/MissedSessions'

export function DashboardPage() {
  const today = todayISO()
  const weekStart = weekStartOf(today)
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()
  const quickMobility = async (t: 'M5' | 'M15') => {
    try { navigate(`/seance/${await repo.startQuickMobility(t)}`) } catch (e) { toast(errorMessage(e), 'error') }
  }
  useEffect(() => { repo.ensureWeek(weekStart).finally(() => setReady(true)) }, [weekStart])

  const week = useLiveQuery(() => repo.listRange(weekStart, addDays(weekStart, 6)), [weekStart])
  const upcoming = useLiveQuery(async () => {
    const list = await repo.listRange(today, addDays(today, 14))
    return list
      .filter((s) => s.status === 'planned')
      .sort((a, b) => (a.date === b.date ? timeToMinutes(a.startTime) - timeToMinutes(b.startTime) : a.date < b.date ? -1 : 1))
  }, [today])
  const settings = useLiveQuery(() => db.settings.get('main'))

  if (!ready || !week || !upcoming) return <div className="page"><Loading /></div>

  const next = upcoming[0]
  const active = week.filter((s) => s.status !== 'cancelled' && s.kind !== 'mobility')
  const done = active.filter((s) => s.status === 'done' || s.status === 'partial')
  const prep = active.filter((s) => s.kind === 'prep')
  const prepDone = prep.filter((s) => s.status === 'done' || s.status === 'partial')
  const daysSinceExport = settings?.lastExportAt ? Math.floor((Date.now() - new Date(settings.lastExportAt).getTime()) / 86400000) : null
  const hasData = week.some((s) => s.kind === 'prep')

  return (
    <div className="page">
      <h1>Bonjour 👊</h1>

      {next ? (
        <section className={`next-card cat-${sessionMeta(next).category}`}>
          <span className="small">Prochaine séance</span>
          <h2>{sessionMeta(next).icon} {sessionMeta(next).label}</h2>
          <p>{next.date === today ? 'Aujourd’hui' : formatLong(next.date)} · {next.startTime} · {formatDuration(next.durationMin)}
            {next.kind === 'prep' && next.environment && ` · ${next.environment === 'gym' ? 'Salle' : 'Domicile'}`}</p>
          <Link className="btn btn-primary btn-lg" to={`/seance/${next.id}`}>{next.kind === 'prep' || next.kind === 'mobility' ? '▶ Démarrer' : 'Ouvrir'}</Link>
        </section>
      ) : (
        <section className="card">
          <p>Aucune séance prévue dans les 15 prochains jours.</p>
        </section>
      )}

      <MissedSessions />
      <RecoveryCard date={today} />

      <section className="card">
        <h2>Mobilité express</h2>
        <p className="small muted">Sans matériel, à faire n’importe quand.</p>
        <div className="row-wrap">
          <button className="btn" onClick={() => quickMobility('M5')}>🧘 5 min — réveil articulaire</button>
          <button className="btn" onClick={() => quickMobility('M15')}>🧘 15 min — récupération</button>
        </div>
      </section>

      {!hasData && (
        <div className="callout callout-info">
          Ta semaine ne contient pas encore de préparation physique. <Link to="/calendrier">Ouvre le calendrier</Link>, choisis ton jour de kick-boxing puis touche « Générer ma semaine ».
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Cette semaine</h2>
          <Link to="/calendrier" className="small">Voir le calendrier →</Link>
        </div>
        <div className="mini-week">
          {weekDates(weekStart).map((d, i) => {
            const items = week.filter((s) => s.date === d && s.status !== 'cancelled')
            return (
              <Link key={d} to="/calendrier" className={`mini-day ${d === today ? 'is-today' : ''}`}>
                <span className="mini-name">{DAY_SHORT[i]}</span>
                <span className="mini-dots">
                  {items.length === 0 && <span className="dot cat-repos" title="Repos" />}
                  {items.map((s) => (
                    <span key={s.id} className={`dot cat-${sessionMeta(s).category} ${s.status !== 'planned' ? 'dot-done' : ''}`} title={sessionMeta(s).label} />
                  ))}
                </span>
              </Link>
            )
          })}
        </div>
        <div className="stats">
          <div><strong>{done.length}/{active.length}</strong><span>séances faites</span></div>
          <div><strong>{prepDone.length}/{prep.length}</strong><span>préparation physique</span></div>
        </div>
      </section>

      {settings && (
        <section className="card">
          <h2>Objectif actuel</h2>
          <p>{settings.goal === 'masse_force' ? 'Prise de masse et force' : settings.goal === 'explosivite' ? 'Explosivité' : 'Mixte'} · {settings.prepSessionsPerWeek} séances de préparation / semaine, dont {settings.gymSessionsPerWeek} en salle.</p>
          <p className="small muted">Méthode : double progression — même charge jusqu’au haut de la fourchette sur toutes les séries, puis le plus petit ajout de charge possible.</p>
        </section>
      )}

      {(daysSinceExport === null || daysSinceExport > 14) && (
        <div className="callout callout-warn">
          💾 {daysSinceExport === null ? 'Tu n’as encore jamais exporté de sauvegarde.' : `Dernière sauvegarde il y a ${daysSinceExport} jours.`}{' '}
          Tes données sont stockées sur cet appareil uniquement. <Link to="/parametres">Exporter une sauvegarde</Link>
        </div>
      )}
    </div>
  )
}
