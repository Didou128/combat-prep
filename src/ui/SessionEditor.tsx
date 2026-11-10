import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDays, DAY_SHORT, dayIndex, formatLong, todayISO, weekStartOf } from '../domain/dates'
import { TEMPLATES } from '../domain/templates'
import type { Environment, PlannedSession, SessionKind, SessionStatus, TemplateId } from '../domain/types'
import { MOBILITY_TEMPLATE_IDS } from '../domain/templates'
import * as repo from '../db/repo'
import { errorMessage, Modal, STATUS_LABELS, useConfirm, useToast } from './common'

type Draft = Omit<PlannedSession, 'id' | 'createdAt' | 'updatedAt'>

const KIND_OPTIONS: { value: SessionKind; label: string }[] = [
  { value: 'prep', label: 'Préparation physique' },
  { value: 'mobility', label: 'Mobilité / récupération' },
  { value: 'kickboxing', label: 'Kick-boxing' },
  { value: 'amhe', label: 'AMHE' },
  { value: 'other', label: 'Autre' },
]

export function SessionEditor({ session, defaultDate, onClose }: { session?: PlannedSession; defaultDate?: string; onClose: () => void }) {
  const confirm = useConfirm()
  const toast = useToast()
  const navigate = useNavigate()
  const [d, setD] = useState<Draft>(
    session ?? {
      date: defaultDate ?? todayISO(), startTime: '18:00', durationMin: 60, kind: 'prep', templateId: 'B',
      environment: 'gym', status: 'planned', source: 'manual',
    },
  )
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  const changeKind = (kind: SessionKind) => {
    setD((x) => {
      const next = { ...x, kind }
      if (kind === 'prep') { next.templateId = x.templateId && ['A', 'B', 'C'].includes(x.templateId) ? x.templateId : 'B'; next.durationMin = 60; next.environment ??= 'gym' }
      else if (kind === 'mobility') { next.templateId = 'M10'; next.durationMin = 10; next.environment = 'home' }
      else { next.templateId = undefined; next.environment = undefined }
      if (kind === 'amhe') { next.durationMin = 240; next.startTime = '13:00' }
      if (kind === 'kickboxing') { next.durationMin = 90; next.startTime = '19:30' }
      return next
    })
  }

  const save = async () => {
    setBusy(true)
    try {
      if (session) await repo.updateSession(session.id, d)
      else await repo.addSession(d)
      toast(session ? 'Séance mise à jour' : 'Séance ajoutée')
      onClose()
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!session) return
    const linked = await repo.linkedDataCount(session.id)
    const ok = await confirm({
      title: 'Supprimer la séance ?',
      message: linked
        ? `Cette séance contient ${linked} enregistrement(s) (séries, journal). Ils seront supprimés définitivement. Pour garder l'historique, préfère « Annulée ».`
        : 'La séance sera supprimée du calendrier.',
      confirmLabel: 'Supprimer', danger: true,
    })
    if (!ok) return
    try {
      await repo.deleteSession(session.id)
      toast('Séance supprimée')
      onClose()
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const ws = weekStartOf(d.date)
  const templatesForKind: TemplateId[] = d.kind === 'mobility' ? MOBILITY_TEMPLATE_IDS : ['A', 'B', 'C']

  return (
    <Modal
      title={session ? 'Modifier la séance' : 'Nouvelle séance'}
      onClose={onClose}
      footer={
        <>
          {session && <button className="btn btn-danger-ghost" onClick={remove}>Supprimer</button>}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>Enregistrer</button>
        </>
      }
    >
      {session && (session.kind === 'prep' || session.kind === 'mobility' || session.kind === 'amhe' || session.kind === 'kickboxing') && (
        <button className="btn btn-primary btn-block mb" onClick={() => navigate(`/seance/${session.id}`)}>
          Ouvrir la séance →
        </button>
      )}
      <div className="form-grid">
        <label className="field">
          <span>Type</span>
          <select value={d.kind} onChange={(e) => changeKind(e.target.value as SessionKind)}>
            {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        {(d.kind === 'prep' || d.kind === 'mobility') && (
          <label className="field">
            <span>Séance type</span>
            <select value={d.templateId} onChange={(e) => { const t = e.target.value as TemplateId; setD((x) => ({ ...x, templateId: t, durationMin: TEMPLATES[t].durationMin })) }}>
              {templatesForKind.map((t) => <option key={t} value={t}>{TEMPLATES[t].name}</option>)}
            </select>
          </label>
        )}
        {d.kind === 'other' && (
          <label className="field">
            <span>Intitulé</span>
            <input value={d.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="ex. Course légère" />
          </label>
        )}
        <div className="field full">
          <span>Jour — {formatLong(d.date)}</span>
          <div className="day-picker" role="group" aria-label="Déplacer vers un jour de la semaine">
            {DAY_SHORT.map((name, i) => (
              <button key={name} type="button" className={`chip ${dayIndex(d.date) === i ? 'chip-on' : ''}`} onClick={() => set('date', addDays(ws, i))}>
                {name}
              </button>
            ))}
          </div>
          <input type="date" value={d.date} onChange={(e) => e.target.value && set('date', e.target.value)} aria-label="Date" />
        </div>
        <label className="field">
          <span>Heure</span>
          <input type="time" value={d.startTime} onChange={(e) => set('startTime', e.target.value)} />
        </label>
        <label className="field">
          <span>Durée (min)</span>
          <input type="number" min={5} max={480} step={5} value={d.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))} />
        </label>
        {(d.kind === 'prep' || d.kind === 'mobility') && (
          <div className="field">
            <span>Lieu</span>
            <div className="seg">
              {(['gym', 'home'] as Environment[]).map((env) => (
                <button key={env} type="button" className={d.environment === env ? 'on' : ''} onClick={() => set('environment', env)}>
                  {env === 'gym' ? '🏋️ Salle' : '🏠 Domicile'}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="field full">
          <span>Statut</span>
          <div className="seg">
            {(Object.keys(STATUS_LABELS) as SessionStatus[]).map((st) => (
              <button key={st} type="button" className={d.status === st ? 'on' : ''} onClick={() => set('status', st)}>{STATUS_LABELS[st]}</button>
            ))}
          </div>
        </div>
        <label className="field full">
          <span>Notes</span>
          <textarea rows={2} value={d.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </label>
      </div>
      {session && (
        <button className="btn btn-ghost mt" onClick={async () => { try { await repo.postponeSession(session.id); toast('Séance reportée au lendemain'); onClose() } catch (e) { toast(errorMessage(e), 'error') } }}>
          ↷ Reporter au lendemain
        </button>
      )}
    </Modal>
  )
}
