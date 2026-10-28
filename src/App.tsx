import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { UIProvider } from './ui/common'
import { DashboardPage } from './pages/DashboardPage'
import { CalendarPage } from './pages/CalendarPage'
import { SessionPage } from './pages/SessionPage'
import { WorkoutPage } from './pages/WorkoutPage'
import { LibraryPage } from './pages/LibraryPage'
import { SettingsPage } from './pages/SettingsPage'

const NAV = [
  { to: '/', label: 'Accueil', icon: '🏠', end: true },
  { to: '/calendrier', label: 'Calendrier', icon: '📅' },
  { to: '/bibliotheque', label: 'Exercices', icon: '📚' },
  { to: '/parametres', label: 'Réglages', icon: '⚙️' },
]

export default function App() {
  return (
    <HashRouter>
      <UIProvider>
        <div className="app">
          <nav className="nav" aria-label="Navigation principale">
            <div className="brand">Combat<span>Prep</span></div>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="nav-icon" aria-hidden="true">{n.icon}</span>
                <span className="nav-label">{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <main className="main">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calendrier" element={<CalendarPage />} />
              <Route path="/seance/:id" element={<SessionPage />} />
              <Route path="/entrainement/:id" element={<WorkoutPage />} />
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
