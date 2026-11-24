import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { setTemplateNames } from './domain/templates'
import { hubHref } from './ui/hub'

// Retour à l'accueil central, seulement quand Combat Prep est servi par celui-ci (sous /sport/).
const HUB = hubHref(import.meta.env.BASE_URL)
import { UIProvider } from './ui/common'
import { DashboardPage } from './pages/DashboardPage'
import { CalendarPage } from './pages/CalendarPage'
import { SessionPage } from './pages/SessionPage'
import { WorkoutPage } from './pages/WorkoutPage'
import { LibraryPage } from './pages/LibraryPage'
import { SettingsPage } from './pages/SettingsPage'
import { ProgressPage } from './pages/ProgressPage'

const NAV = [
  { to: '/', label: 'Accueil', icon: '🏠', end: true },
  { to: '/calendrier', label: 'Calendrier', icon: '📅' },
  { to: '/progres', label: 'Progrès', icon: '📈' },
  { to: '/bibliotheque', label: 'Exercices', icon: '📚' },
  { to: '/parametres', label: 'Réglages', icon: '⚙️' },
]

export default function App() {
  // Noms des séances choisis dans les réglages : mis à jour avant le rendu des pages,
  // qui les lisent toutes via templateName(). Se relance à chaque modification des réglages.
  const names = useLiveQuery(() => db.settings.get('main').then((s) => s?.templateNames ?? null))
  setTemplateNames(names)

  return (
    <HashRouter>
      <UIProvider>
        <div className="app">
          <nav className="nav" aria-label="Navigation principale">
            {HUB && <a className="hub-link hub-link-nav" href={HUB}>← Accueil</a>}
            <div className="brand">Combat<span>Prep</span></div>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="nav-icon" aria-hidden="true">{n.icon}</span>
                <span className="nav-label">{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <main className="main">
            {HUB && <div className="hub-top"><a className="hub-link" href={HUB}>← Accueil</a></div>}
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calendrier" element={<CalendarPage />} />
              <Route path="/seance/:id" element={<SessionPage />} />
              <Route path="/entrainement/:id" element={<WorkoutPage />} />
              <Route path="/progres" element={<ProgressPage />} />
              <Route path="/bibliotheque" element={<LibraryPage />} />
              <Route path="/parametres" element={<SettingsPage />} />
              <Route path="*" element={<div className="page"><p>Page introuvable.</p></div>} />
            </Routes>
          </main>
        </div>
      </UIProvider>
    </HashRouter>
  )
}
