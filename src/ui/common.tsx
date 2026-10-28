import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { TEMPLATES } from '../domain/templates'
import type { PlannedSession, SessionStatus } from '../domain/types'

// ---------- Méta-données visuelles ----------

export type Category = 'combat' | 'force' | 'explosivite' | 'mobilite' | 'autre'

export function sessionMeta(s: Pick<PlannedSession, 'kind' | 'templateId' | 'title'>): { label: string; category: Category; icon: string } {
  switch (s.kind) {
    case 'amhe': return { label: 'AMHE', category: 'combat', icon: '⚔️' }
    case 'kickboxing': return { label: 'Kick-boxing', category: 'combat', icon: '🥊' }
    case 'mobility': return { label: s.templateId ? TEMPLATES[s.templateId].name : 'Mobilité', category: 'mobilite', icon: '🧘' }
    case 'prep': {
      const t = s.templateId ? TEMPLATES[s.templateId] : undefined
      return { label: t?.name ?? 'Préparation physique', category: t?.explosive ? 'explosivite' : 'force', icon: t?.explosive ? '⚡' : '🏋️' }
    }
    default: return { label: s.title || 'Autre séance', category: 'autre', icon: '•' }
  }
}

export const STATUS_LABELS: Record<SessionStatus, string> = {
  planned: 'Prévue', done: 'Terminée', partial: 'Partielle', cancelled: 'Annulée',
}

export function StatusBadge({ status }: { status: SessionStatus }) {
  if (status === 'planned') return null
  const icon = status === 'done' ? '✓' : status === 'partial' ? '◐' : '✕'
  return <span className={`badge badge-${status}`}>{icon} {STATUS_LABELS[status]}</span>
}

export function formatDuration(min: number) {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

// ---------- Modale ----------

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- Confirmation & notifications ----------

interface ConfirmOptions { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean }
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>
type ToastFn = (msg: string, kind?: 'ok' | 'error' | 'info') => void

const ConfirmCtx = createContext<ConfirmFn>(async () => false)
const ToastCtx = createContext<ToastFn>(() => {})

export function UIProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([])

  const confirm = useCallback<ConfirmFn>((o) => new Promise((resolve) => setConfirmState({ ...o, resolve })), [])
  const toast = useCallback<ToastFn>((msg, kind = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])

  const close = (v: boolean) => {
    confirmState?.resolve(v)
    setConfirmState(null)
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      <ToastCtx.Provider value={toast}>
        {children}
        {confirmState && (
          <Modal
            title={confirmState.title}
            onClose={() => close(false)}
            footer={
              <>
                <button className="btn" onClick={() => close(false)}>Annuler</button>
                <button className={`btn ${confirmState.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
                  {confirmState.confirmLabel ?? 'Confirmer'}
                </button>
              </>
            }
          >
            <div>{confirmState.message}</div>
          </Modal>
        )}
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.msg}</div>)}
        </div>
      </ToastCtx.Provider>
    </ConfirmCtx.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmCtx)
export const useToast = () => useContext(ToastCtx)

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Une erreur est survenue.'
}

// ---------- Champs ----------

export function Stepper({ value, onChange, step = 1, min = 0, max = 999, label, suffix }: {
  value: number | ''; onChange: (v: number | '') => void; step?: number; min?: number; max?: number; label: string; suffix?: string
}) {
  const num = value === '' ? 0 : value
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button type="button" className="step-btn" aria-label={`Diminuer ${label}`} onClick={() => onChange(clamp(num - step))}>−</button>
        <input
          inputMode="decimal" aria-label={label} value={value}
          onChange={(e) => {
            const t = e.target.value.replace(',', '.')
            if (t === '') return onChange('')
            const v = Number(t)
            if (!Number.isNaN(v)) onChange(v)
          }}
        />
        {suffix && <span className="stepper-suffix">{suffix}</span>}
        <button type="button" className="step-btn" aria-label={`Augmenter ${label}`} onClick={() => onChange(clamp(num + step))}>+</button>
      </div>
    </div>
  )
}

export function Loading() {
  return <div className="loading" aria-busy="true">Chargement…</div>
}
