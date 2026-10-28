import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { CATEGORY_LABELS, EQUIPMENT_LABELS, EXERCISES, getExercise, isAvailable, MUSCLE_LABELS } from '../domain/exercises'
import type { Exercise } from '../domain/types'
import { equipmentFor } from './SessionPage'

const LEVELS = ['', 'Débutant', 'Intermédiaire', 'Avancé']

export function LibraryPage() {
  const settings = useLiveQuery(() => db.settings.get('main'))
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [muscle, setMuscle] = useState('')
  const [env, setEnv] = useState<'' | 'gym' | 'home'>('')
  const [level, setLevel] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const list = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    return EXERCISES.filter((e) =>
      (!q || norm(e.name + ' ' + e.primaryMuscles).includes(norm(q))) &&
      (!cat || e.category === cat) &&
      (!muscle || e.muscles.includes(muscle as Exercise['muscles'][number])) &&
      (!level || e.level === Number(level)) &&
      (!env || !settings || isAvailable(e, equipmentFor(settings, env))),
    )
  }, [q, cat, muscle, env, level, settings])

  return (
    <div className="page">
      <h1>Bibliothèque d’exercices</h1>
      <div className="filters">
        <input type="search" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un exercice" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Objectif">
          <option value="">Tous les objectifs</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="Groupe musculaire">
          <option value="">Tous les muscles</option>
          {Object.entries(MUSCLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={env} onChange={(e) => setEnv(e.target.value as '' | 'gym' | 'home')} aria-label="Environnement">
          <option value="">Salle et domicile</option>
          <option value="gym">Faisable en salle</option>
          <option value="home">Faisable chez moi (mon matériel)</option>
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Niveau">
          <option value="">Tous niveaux</option>
          {[1, 2, 3].map((l) => <option key={l} value={l}>{LEVELS[l]}</option>)}
        </select>
      </div>
      <p className="small muted">{list.length} exercice(s)</p>
      <ul className="lib-list">
        {list.map((e) => (
          <li key={e.id} className={`lib-item cat-${e.category === 'force' ? 'force' : e.category === 'explosivite' ? 'explosivite' : e.category === 'mobilite' ? 'mobilite' : 'combat'}`}>
            <button className="lib-head" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
              <span><strong>{e.name}</strong><br /><span className="small muted">{e.primaryMuscles}</span></span>
              <span className="tags">
                <span className="tag">{CATEGORY_LABELS[e.category]}</span>
                {e.mobilityType && <span className="tag">{e.mobilityType === 'dynamique' ? 'Avant l’effort' : 'Après l’effort'}</span>}
                <span className="tag">{e.equipment.length ? e.equipment.map((x) => EQUIPMENT_LABELS[x]).join(' + ') : 'Poids du corps'}</span>
              </span>
            </button>
            {open === e.id && (
              <div className="lib-body">
                <p>{e.description}</p>
                <h3>Consignes</h3>
                <ul>{e.cues.map((c) => <li key={c}>{c}</li>)}</ul>
                {e.precautions && <p className="warn-text">⚠️ {e.precautions}</p>}
                <p className="small">Niveau : {LEVELS[e.level]}{e.perSide ? ' · par côté' : ''}</p>
                {e.substitutes.length > 0 && <p className="small">Remplacements : {e.substitutes.map((s) => getExercise(s).name).join(', ')}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
