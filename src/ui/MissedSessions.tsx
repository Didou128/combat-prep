import { useLiveQuery } from 'dexie-react-hooks'
import * as repo from '../db/repo'
import { formatLong, todayISO } from '../domain/dates'
import { describeOption, type RescheduleOption } from '../domain/reschedule'
import type { PlannedSession } from '../domain/types'
import { errorMessage, sessionMeta, useConfirm, useToast } from './common'

/** Séances de préparation passées et non faites, avec les options de réorganisation. */
export function MissedSessions() {
  const today = todayISO()
  const missed = useLiveQuery(() => repo.listMissed(today), [today])
  if (!missed?.length) return null
  return (
    <section className="card card-warn" aria-label="Séances manquées">
      <h2>Séance{missed.length > 1 ? 's' : ''} manquée{missed.length > 1 ? 's' : ''}</h2>
      <p className="small muted">
        Pas de rattrapage en double : la séance n’est replacée que sur un jour libre de la même semaine, en respectant la récupération avant les combats.
      </p>
      {missed.map((s) => <MissedItem key={s.id} session={s} today={today} />)}
    </section>
  )
}

function MissedItem({ session, today }: { session: PlannedSession; today: string }) {
  const toast = useToast()
  const confirm = useConfirm()
  // Requête « live » : les options se recalculent dès qu'une séance de la semaine change.
  const options = useLiveQuery(() => repo.rescheduleOptions(session.id, today).catch(() => null), [session.id, today])

  const apply = async (o: RescheduleOption) => {
    if (o.kind === 'skip') {
      const ok = await confirm({
        title: 'Ne pas rattraper ?',
        message: 'La séance sera marquée « annulée » (elle reste visible dans l’historique). La semaine continue normalement.',
        confirmLabel: 'Ne pas rattraper',
      })
      if (!ok) return
    }
    try {
      await repo.applyReschedule(session.id, o)
      toast(o.kind === 'move' ? `Séance déplacée à ${formatLong(o.date).toLowerCase()}` : o.kind === 'replace' ? 'Séance remplacée' : 'Séance non rattrapée')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const fmt = (d: string) => (d === today ? 'aujourd’hui' : formatLong(d).toLowerCase())
  const moves = options?.filter((o) => o.kind === 'move') ?? []
  const others = options?.filter((o) => o.kind !== 'move') ?? []
  return (
    <div className="missed-item">
      <p><strong>{sessionMeta(session).icon} {sessionMeta(session).label}</strong> <span className="muted">— prévue {formatLong(session.date).toLowerCase()}</span></p>
      {!options ? <p className="muted small">Recherche des options…</p> : (
        <>
          {moves.length === 0 && others.length === 1 && (
            <p className="small">Aucun jour libre ne respecte les règles de récupération d’ici la fin de la semaine.</p>
          )}
          <div className="option-list">
            {moves.slice(0, 3).map((o) => (
              <button key={o.kind + (o.kind === 'move' ? o.date : '')} className={`btn btn-sm ${o.kind === 'move' && o.recommended ? 'btn-primary' : ''}`} onClick={() => apply(o)}>
                {describeOption(o, session.templateId!, fmt)}{o.kind === 'move' && o.recommended ? ' (conseillé)' : ''}
              </button>
            ))}
            {others.map((o) => (
              <button key={o.kind + (o.kind === 'replace' ? o.targetId : '')} className={`btn btn-sm ${o.kind === 'skip' ? 'btn-ghost' : ''}`} onClick={() => apply(o)}>
                {describeOption(o, session.templateId!, fmt)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
