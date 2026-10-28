import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/db'
import * as repo from '../db/repo'
import { formatLong } from '../domain/dates'
import { buildSession, TEMPLATES } from '../domain/templates'
import { EQUIPMENT_LABELS } from '../domain/exercises'
import type { Environment, EquipmentId, PlannedSession, Settings } from '../domain/types'
import { errorMessage, formatDuration, Loading, sessionMeta, StatusBadge, useConfirm, useToast } from '../ui/common'

export const equipmentFor = (settings: Settings, env: Environment): EquipmentId[] => {
  if (env === 'gym') return settings.gymEquipment
  // Le sac lesté n'est proposé que s'il est déclaré avec un poids.
  return settings.homeEquipment.filter((e) => e !== 'backpack' || settings.backpackMaxKg > 0)
}

export function SessionPage() {
  const { id = '' } = useParams()
  const session = useLiveQuery(() => db.sessions.get(id), [id], null as PlannedSession | null | undefined)
  const settings = useLiveQuery(() => db.settings.get('main'))
  if (session === null || settings === undefined) return <div className="page"><Loading /></div>
  if (!session) return <div className="page"><p>Séance introuvable.</p><Link to="/calendrier">← Calendrier</Link></div>
  if (session.kind === 'amhe' || session.kind === 'kickboxing') return <CombatSession session={session} />
  return <TrainingSession session={session} settings={settings!} />
}

function Header({ session }: { session: PlannedSession }) {
  const m = sessionMeta(session)
  return (
    <header className={`session-hero cat-${m.category}`}>
      <Link to={`/calendrier?semaine=${session.date}`} className="back">← Calendrier</Link>
      <h1>{m.icon} {m.label}</h1>
      <p>{formatLong(session.date)} · {session.startTime} · {formatDuration(session.durationMin)} <StatusBadge status={session.status} /></p>
    </header>
  )
}

function TrainingSession({ session, settings }: { session: PlannedSession; settings: Settings }) {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const env = session.environment ?? 'home'
  const [showTired, setShowTired] = useState(false)
  const workouts = useLiveQuery(() => db.workouts.where('plannedSessionId').equals(session.id).toArray(), [session.id])
  const sets = useLiveQuery(async () => {
    const ids = (workouts ?? []).map((w) => w.id)
    return ids.length ? db.sets.where('workoutLogId').anyOf(ids).toArray() : []
  }, [workouts])

  if (!session.templateId) return <div className="page"><Header session={session} /><p>Cette séance n’a pas de contenu type.</p></div>
  const tpl = TEMPLATES[session.templateId]
  const slots = buildSession(session.templateId, env, equipmentFor(settings, env), session.light)
  const inProgress = workouts?.find((w) => w.status === 'in_progress')

  const update = async (patch: Partial<PlannedSession>, msg: string) => {
    try { await repo.updateSession(session.id, patch); toast(msg) } catch (e) { toast(errorMessage(e), 'error') }
  }

  return (
    <div className="page">
      <Header session={session} />
      <p className="muted">{tpl.focus}</p>

      <div className="row-wrap">
        <div className="seg" role="group" aria-label="Lieu">
          {(['gym', 'home'] as Environment[]).map((e) => (
            <button key={e} className={env === e ? 'on' : ''} onClick={() => update({ environment: e }, e === 'gym' ? 'Version salle' : 'Version domicile')}>
              {e === 'gym' ? '🏋️ Salle' : '🏠 Domicile'}
            </button>
          ))}
        </div>
        {session.kind === 'prep' && (
          session.light
            ? <button className="btn btn-ghost" onClick={() => update({ light: false }, 'Version normale rétablie')}>Revenir à la version normale</button>
            : <button className="btn btn-ghost" onClick={() => setShowTired((v) => !v)}>😮‍💨 Je suis fatigué</button>
        )}
      </div>

      {showTired && (
        <div className="callout callout-info">
          <p><strong>Adapter la séance</strong> — ces propositions sont indicatives : écoute tes sensations et, en cas de douleur, consulte un professionnel de santé.</p>
          <div className="row-wrap">
            <button className="btn" onClick={() => { setShowTired(false); update({ light: true }, 'Version allégée : une série de moins, sans explosivité') }}>Version allégée</button>
            <button className="btn" onClick={() => { setShowTired(false); update({ kind: 'mobility', templateId: 'M20', durationMin: 20, light: false }, 'Remplacée par 20 min de mobilité') }}>Remplacer par 20 min de mobilité</button>
            <button className="btn" onClick={async () => {
              setShowTired(false)
              if (await confirm({ title: 'Reporter au lendemain ?', message: 'Vérifie ensuite les avertissements du calendrier : le lendemain peut être une veille de combat.' })) {
                await repo.postponeSession(session.id); toast('Séance reportée')
              }
            }}>Reporter au lendemain</button>
          </div>
        </div>
      )}

      <ol className="exercise-list">
        {slots.map((s, i) => {
          const done = (sets ?? []).filter((x) => x.exerciseId === s.exercise.id).length
          return (
            <li key={i} className="exercise-item">
              <div>
                <strong>{s.exercise.name}</strong>
                {s.substituted && <span className="tag" title="Matériel indisponible pour l’exercice prévu">remplacement</span>}
                <div className="muted small">
                  {s.sets} × {s.reps ? (s.reps[0] === s.reps[1] ? s.reps[0] : `${s.reps[0]}–${s.reps[1]}`) : `${s.durationSec} s`}
                  {s.rirTarget && ` · RIR ${s.rirTarget[0]}–${s.rirTarget[1]}`}
                  {s.restSec > 0 && ` · repos ${s.restSec >= 60 ? `${Math.floor(s.restSec / 60)} min${s.restSec % 60 ? ` ${s.restSec % 60}` : ''}` : `${s.restSec} s`}`}
                  {s.note && ` · ${s.note}`}
                </div>
                {s.exercise.equipment.length > 0 && <div className="muted small">Matériel : {s.exercise.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')}</div>}
              </div>
              {done > 0 && <span className="badge badge-done">{done}/{s.sets}</span>}
            </li>
          )
        })}
      </ol>

      <div className="sticky-actions">
        <button className="btn btn-primary btn-lg btn-block" onClick={() => navigate(`/entrainement/${session.id}`)}>
          {inProgress ? '▶ Reprendre la séance' : session.status === 'planned' ? '▶ Démarrer la séance' : '▶ Refaire / compléter la séance'}
        </button>
        {session.status === 'planned' && (
          <div className="row-wrap mt">
            <button className="btn btn-ghost" onClick={() => update({ status: 'done' }, 'Marquée terminée')}>Marquer terminée sans détail</button>
            <button className="btn btn-ghost" onClick={() => update({ status: 'cancelled' }, 'Séance annulée')}>Annuler la séance</button>
          </div>
        )}
      </div>
    </div>
  )
}

function CombatSession({ session }: { session: PlannedSession }) {
  const toast = useToast()
  const existing = useLiveQuery(() => db.combatLogs.where('plannedSessionId').equals(session.id).first(), [session.id])
  const [form, setForm] = useState<{ durationMin: number; intensity: number; fatigueAfter: number; notes: string } | null>(null)
  const f = form ?? {
    durationMin: existing?.durationMin ?? session.durationMin,
    intensity: existing?.intensity ?? 6,
    fatigueAfter: existing?.fatigueAfter ?? 5,
    notes: existing?.notes ?? '',
  }
  const set = (k: keyof typeof f, v: number | string) => setForm({ ...f, [k]: v })

  const save = async () => {
    try {
      await repo.saveCombatLog(session.id, f)
      toast('Séance de combat enregistrée')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  return (
    <div className="page">
      <Header session={session} />
      <div className="card">
        <h2>Compte rendu</h2>
        <div className="form-grid">
          <label className="field">
            <span>Durée réelle (min)</span>
            <input type="number" min={5} max={480} value={f.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))} />
          </label>
          <label className="field full">
            <span>Intensité ressentie : <strong>{f.intensity}/10</strong></span>
            <input type="range" min={1} max={10} value={f.intensity} onChange={(e) => set('intensity', Number(e.target.value))} />
          </label>
          <label className="field full">
            <span>Fatigue après la séance : <strong>{f.fatigueAfter}/10</strong></span>
            <input type="range" min={1} max={10} value={f.fatigueAfter} onChange={(e) => set('fatigueAfter', Number(e.target.value))} />
          </label>
          <label className="field full">
            <span>Notes (sparring, technique travaillée…)</span>
            <textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>
        <div className="row-wrap mt">
          <button className="btn btn-primary" onClick={save}>{existing ? 'Mettre à jour' : 'Enregistrer — séance effectuée'}</button>
          {session.status === 'planned' && (
            <button className="btn btn-ghost" onClick={async () => { await repo.updateSession(session.id, { status: 'cancelled' }); toast('Séance annulée') }}>Séance annulée</button>
          )}
        </div>
      </div>
    </div>
  )
}
