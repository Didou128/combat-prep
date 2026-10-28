import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS, nowISO } from '../db/db'
import * as repo from '../db/repo'
import { backupSummary, exportBackup, importBackup, parseBackup } from '../db/backup'
import { DAY_NAMES, todayISO } from '../domain/dates'
import { ALL_GYM_EQUIPMENT, EQUIPMENT_LABELS, HOME_EQUIPMENT_CHOICES } from '../domain/exercises'
import type { DayIndex, EquipmentId, Settings } from '../domain/types'
import { errorMessage, Loading, useConfirm, useToast } from '../ui/common'

export function SettingsPage() {
  const stored = useLiveQuery(() => db.settings.get('main'))
  const [s, setS] = useState<Settings | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (stored && !s) setS({ ...DEFAULT_SETTINGS, ...stored }) }, [stored, s])
  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null)) }, [])

  if (!s) return <div className="page"><Loading /></div>
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v })
  const toggleEq = (key: 'homeEquipment' | 'gymEquipment', id: EquipmentId) =>
    set(key, s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id])

  const save = async () => {
    try {
      await repo.saveSettings(s)
      toast('Paramètres enregistrés. Le jour habituel du kick-boxing s’applique aux semaines pas encore ouvertes.')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const doExport = async () => {
    try {
      const b = await exportBackup()
      const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' })
      const name = `combat-prep-sauvegarde-${todayISO()}.json`
      const file = new File([blob], name, { type: 'application/json' })
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
      if (nav.canShare?.({ files: [file] }) && /iPhone|iPad/.test(navigator.userAgent)) {
        await navigator.share({ files: [file], title: 'Sauvegarde Combat Prep' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = name; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
      }
      const cur = (await db.settings.get('main')) ?? DEFAULT_SETTINGS
      await db.settings.put({ ...cur, lastExportAt: nowISO() })
      setS((x) => (x ? { ...x, lastExportAt: nowISO() } : x))
      toast('Sauvegarde exportée')
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast(errorMessage(e), 'error')
    }
  }

  const doImport = async (file: File) => {
    try {
      const parsed = parseBackup(await file.text())
      const ok = await confirm({
        title: 'Remplacer toutes les données ?',
        message: <>Cette sauvegarde contient : {backupSummary(parsed)}.<br /><br /><strong>Toutes les données actuelles de cet appareil seront remplacées.</strong> Exporte d’abord une sauvegarde si tu veux les garder.</>,
        confirmLabel: 'Importer et remplacer', danger: true,
      })
      if (!ok) return
      await importBackup(parsed)
      setS(null)
      toast('Sauvegarde importée')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const requestPersist = async () => {
    const ok = await navigator.storage?.persist?.()
    setPersisted(!!ok)
    toast(ok ? 'Stockage persistant activé' : 'Le navigateur a refusé (installe l’app sur l’écran d’accueil)', ok ? 'ok' : 'info')
  }

  return (
    <div className="page">
      <h1>Paramètres</h1>

      <section className="card">
        <h2>Profil sportif</h2>
        <div className="form-grid">
          <label className="field"><span>Niveau en musculation</span>
            <select value={s.level} onChange={(e) => set('level', e.target.value as Settings['level'])}>
              <option value="debutant">Débutant</option><option value="intermediaire">Intermédiaire</option><option value="avance">Avancé</option>
            </select>
          </label>
          <label className="field"><span>Objectif prioritaire</span>
            <select value={s.goal} onChange={(e) => set('goal', e.target.value as Settings['goal'])}>
              <option value="masse_force">Prise de masse et force</option><option value="explosivite">Explosivité</option><option value="mixte">Mixte</option>
            </select>
          </label>
          <label className="field"><span>Séances de préparation / semaine</span>
            <select value={s.prepSessionsPerWeek} onChange={(e) => set('prepSessionsPerWeek', Number(e.target.value) as 2 | 3 | 4)}>
              <option value={2}>2 (A + B)</option><option value={3}>3 (A + B + C)</option><option value={4}>4 (A + B + C + B)</option>
            </select>
          </label>
          <label className="field"><span>Dont en salle</span>
            <input type="number" min={0} max={7} value={s.gymSessionsPerWeek} onChange={(e) => set('gymSessionsPerWeek', Number(e.target.value))} />
          </label>
          <label className="field"><span>Heure habituelle de préparation</span>
            <input type="time" value={s.prepDefaultTime} onChange={(e) => set('prepDefaultTime', e.target.value)} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Sports de combat</h2>
        <div className="form-grid">
          <label className="field"><span>Kick-boxing : jour habituel</span>
            <select value={s.kickboxing.weekday} onChange={(e) => set('kickboxing', { ...s.kickboxing, weekday: Number(e.target.value) as DayIndex })}>
              {DAY_NAMES.slice(0, 6).map((n, i) => <option key={n} value={i}>{n}</option>)}
            </select>
          </label>
          <label className="field"><span>Kick-boxing : heure</span>
            <input type="time" value={s.kickboxing.startTime} onChange={(e) => set('kickboxing', { ...s.kickboxing, startTime: e.target.value })} />
          </label>
          <label className="field"><span>Kick-boxing : durée (min)</span>
            <input type="number" min={15} max={300} value={s.kickboxing.durationMin} onChange={(e) => set('kickboxing', { ...s.kickboxing, durationMin: Number(e.target.value) })} />
          </label>
          <label className="field"><span>AMHE (dimanche) : heure</span>
            <input type="time" value={s.amhe.startTime} onChange={(e) => set('amhe', { ...s.amhe, startTime: e.target.value })} />
          </label>
          <label className="field"><span>AMHE : durée (min)</span>
            <input type="number" min={15} max={480} value={s.amhe.durationMin} onChange={(e) => set('amhe', { ...s.amhe, durationMin: Number(e.target.value) })} />
          </label>
        </div>
        <p className="small muted">Ces valeurs servent de modèle pour les nouvelles semaines. Pour changer le jour du kick-boxing d’une seule semaine, utilise le calendrier.</p>
      </section>

      <section className="card">
        <h2>Matériel à domicile</h2>
        <div className="checks">
          {HOME_EQUIPMENT_CHOICES.map((id) => (
            <label key={id} className="check"><input type="checkbox" checked={s.homeEquipment.includes(id)} onChange={() => toggleEq('homeEquipment', id)} /> {EQUIPMENT_LABELS[id]}</label>
          ))}
        </div>
        {s.homeEquipment.includes('backpack') && (
          <label className="field mt"><span>Poids maximal du sac lesté (kg)</span>
            <input type="number" min={0} max={60} step={0.5} value={s.backpackMaxKg} onChange={(e) => set('backpackMaxKg', Number(e.target.value))} />
            <span className="hint">1 L d’eau ≈ 1 kg. Pèse ton sac une fois rempli.</span>
          </label>
        )}
      </section>

      <section className="card">
        <h2>Matériel en salle</h2>
        <div className="checks">
          {ALL_GYM_EQUIPMENT.map((id) => (
            <label key={id} className="check"><input type="checkbox" checked={s.gymEquipment.includes(id)} onChange={() => toggleEq('gymEquipment', id)} /> {EQUIPMENT_LABELS[id]}</label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Progression des charges</h2>
        <div className="form-grid">
          <label className="field"><span>Plus petit écart entre haltères (kg)</span>
            <input type="number" min={0.5} max={10} step={0.5} value={s.dumbbellIncrementKg} onChange={(e) => set('dumbbellIncrementKg', Number(e.target.value))} />
          </label>
          <label className="field"><span>Ajout minimal à la barre (kg)</span>
            <input type="number" min={0.5} max={10} step={0.5} value={s.barbellIncrementKg} onChange={(e) => set('barbellIncrementKg', Number(e.target.value))} />
          </label>
        </div>
      </section>

      <div className="sticky-actions"><button className="btn btn-primary btn-lg btn-block" onClick={save}>Enregistrer les paramètres</button></div>

      <section className="card">
        <h2>Sauvegarde et transfert entre appareils</h2>
        <p className="small">Les données sont stockées sur cet appareil. Pour passer de l’iPhone au PC (ou l’inverse) : exporte ici, envoie-toi le fichier, puis importe-le sur l’autre appareil.</p>
        <p className="small muted">{s.lastExportAt ? `Dernier export : ${new Date(s.lastExportAt).toLocaleString('fr-FR')}` : 'Aucun export pour le moment.'}</p>
        <div className="row-wrap">
          <button className="btn btn-primary" onClick={doExport}>⬇ Exporter une sauvegarde</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>⬆ Importer une sauvegarde</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        </div>
        <p className="small mt">
          Stockage persistant : {persisted === null ? 'inconnu' : persisted ? '✓ activé' : 'non activé'}
          {persisted === false && <> — <button className="link" onClick={requestPersist}>demander</button></>}
        </p>
      </section>

      <section className="card small muted">
        <h2>À savoir</h2>
        <p>Les recommandations (allègement, progression) sont indicatives et ne remplacent pas l’avis d’un professionnel de santé. En cas de douleur, arrête l’exercice.</p>
      </section>
    </div>
  )
}
