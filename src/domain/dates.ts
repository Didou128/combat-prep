import type { DayIndex } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Date locale -> YYYY-MM-DD (sans conversion UTC). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12) // midi : évite les soucis de changement d'heure
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** 0 = lundi … 6 = dimanche */
export function dayIndex(iso: string): DayIndex {
  return ((parseISODate(iso).getDay() + 6) % 7) as DayIndex
}

/** Lundi de la semaine contenant la date. */
export function weekStartOf(iso: string): string {
  return addDays(iso, -dayIndex(iso))
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function todayISO(): string {
  return toISODate(new Date())
}

export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export function formatShort(iso: string): string {
  const d = parseISODate(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function formatLong(iso: string): string {
  return `${DAY_NAMES[dayIndex(iso)]} ${formatShort(iso)}`
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t)
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return toISODate(parseISODate(s)) === s
}
