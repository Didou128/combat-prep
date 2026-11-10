import { useState, type ReactNode } from 'react'

/**
 * Graphiques SVG légers (pas de dépendance) : une seule échelle par graphique,
 * traits fins, info-bulle au survol / toucher / clavier, tableau des données à côté.
 * Couleurs validées pour le fond sombre (contraste ≥ 3:1, distinctes en daltonisme).
 */
export const CHART_COLORS = { blue: '#5b7ef5', orange: '#e8600f', gray: '#4a505c' }

const W = 600
const H = 220
const PAD = { top: 16, right: 44, bottom: 28, left: 40 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const ticks: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100)
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round((ticks[ticks.length - 1] + step) * 100) / 100)
  return ticks
}

const fmt = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)} k` : v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} k` : String(v).replace('.', ','))

interface Tip { x: number; y: number; content: ReactNode }

function Frame({ ticks, yMax, labels, xAt, tip, ariaLabel, children }: {
  ticks: number[]; yMax: number; labels: string[]; xAt: (i: number) => number; tip: Tip | null; ariaLabel: string; children: ReactNode
}) {
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH
  // Étiquettes d'abscisse espacées pour éviter les chevauchements.
  const every = Math.max(1, Math.ceil(labels.length / 7))
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="chart-tick">{fmt(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (i % every === 0 || i === labels.length - 1) && (
          <text key={i} x={xAt(i)} y={H - 8} textAnchor="middle" className="chart-tick">{l}</text>
        ))}
        {children}
      </svg>
      {tip && (
        <div className="chart-tip" style={{ left: `${(tip.x / W) * 100}%`, top: `${(tip.y / H) * 100}%` }} role="status">
          {tip.content}
        </div>
      )}
    </div>
  )
}

export interface LinePoint { label: string; value: number; tooltip: ReactNode }

/** Courbe d'une seule série (le titre du graphique la nomme : pas de légende). */
export function LineChart({ points, ariaLabel, unit = '' }: { points: LinePoint[]; ariaLabel: string; unit?: string }) {
  const [active, setActive] = useState<number | null>(null)
  const ticks = niceTicks(Math.max(...points.map((p) => p.value)))
  const yMax = ticks[ticks.length - 1]
  const xAt = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  const yAt = (v: number) => PAD.top + plotH - (v / yMax) * plotH
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${xAt(i)},${yAt(p.value)}`).join(' ')
  const last = points[points.length - 1]
  const tip = active !== null ? { x: xAt(active), y: yAt(points[active].value), content: points[active].tooltip } : null
  return (
    <Frame ticks={ticks} yMax={yMax} labels={points.map((p) => p.label)} xAt={xAt} tip={tip} ariaLabel={ariaLabel}>
      <path d={path} fill="none" stroke={CHART_COLORS.blue} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {active !== null && <line x1={xAt(active)} x2={xAt(active)} y1={PAD.top} y2={PAD.top + plotH} className="chart-cross" />}
      {points.map((p, i) => (
        <g key={i} tabIndex={0} role="button" aria-label={`${p.label} : ${fmt(p.value)} ${unit}`}
          onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
          onFocus={() => setActive(i)} onBlur={() => setActive(null)} onClick={() => setActive(active === i ? null : i)}>
          <circle cx={xAt(i)} cy={yAt(p.value)} r={14} fill="transparent" />
          <circle cx={xAt(i)} cy={yAt(p.value)} r={active === i ? 6 : 4} fill={CHART_COLORS.blue} stroke="var(--surface)" strokeWidth={2} />
        </g>
      ))}
      <text x={xAt(points.length - 1) + 8} y={yAt(last.value) + 4} className="chart-value">{fmt(last.value)}{unit && ` ${unit}`}</text>
    </Frame>
  )
}

export interface ColumnSeries { name: string; color: string; values: number[] }

/** Colonnes (empilées si plusieurs séries). Légende dès 2 séries. */
export function ColumnChart({ labels, series, ariaLabel, tooltip }: {
  labels: string[]; series: ColumnSeries[]; ariaLabel: string; tooltip: (i: number) => ReactNode
}) {
  const [active, setActive] = useState<number | null>(null)
  const totals = labels.map((_, i) => series.reduce((a, s) => a + s.values[i], 0))
  const ticks = niceTicks(Math.max(...totals))
  const yMax = ticks[ticks.length - 1]
  const band = plotW / labels.length
  const barW = Math.min(24, band * 0.6)
  const xAt = (i: number) => PAD.left + band * i + band / 2
  const h = (v: number) => (v / yMax) * plotH
  const base = PAD.top + plotH
  const tip = active !== null ? { x: xAt(active), y: base - h(totals[active]), content: tooltip(active) } : null
  return (
    <>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}
        </div>
      )}
      <Frame ticks={ticks} yMax={yMax} labels={labels} xAt={xAt} tip={tip} ariaLabel={ariaLabel}>
        {labels.map((l, i) => {
          let top = base
          const segs = series.map((s) => ({ s, v: s.values[i] })).filter((x) => x.v > 0)
          return (
            <g key={i} tabIndex={0} role="button" aria-label={`${l} : ${series.map((s) => `${s.name} ${s.values[i]}`).join(', ')}`}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)} onBlur={() => setActive(null)} onClick={() => setActive(active === i ? null : i)}>
              <rect x={xAt(i) - band / 2} y={PAD.top} width={band} height={plotH} fill="transparent" />
              {active === i && <rect x={xAt(i) - band / 2 + 2} y={PAD.top} width={band - 4} height={plotH} className="chart-hover" />}
              {segs.map(({ s, v }, k) => {
                const hh = h(v)
                const y0 = top - hh
                // Écart de 2 px (couleur du fond) entre segments empilés ; arrondi de 4 px uniquement au sommet.
                const gap = k > 0 ? 2 : 0
                top = y0
                const x = xAt(i) - barW / 2
                const yTop = y0, yBot = y0 + hh - gap
                const isTop = k === segs.length - 1
                const r = isTop ? Math.min(4, (yBot - yTop) / 2, barW / 2) : 0
                const d = `M${x},${yBot} L${x},${yTop + r} Q${x},${yTop} ${x + r},${yTop} L${x + barW - r},${yTop} Q${x + barW},${yTop} ${x + barW},${yTop + r} L${x + barW},${yBot} Z`
                return <path key={s.name} d={d} fill={s.color} />
              })}
            </g>
          )
        })}
      </Frame>
    </>
  )
}

/** Tableau des valeurs (accessibilité, et lecture exacte des chiffres). */
export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="chart-table">
      <summary>Voir les données</summary>
      <table>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </details>
  )
}
