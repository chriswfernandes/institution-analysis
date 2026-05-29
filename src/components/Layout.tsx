import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  FileText,
  BarChart2,
  Settings,
  GraduationCap,
  Search,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react'
import { ToastContainer } from './ToastContainer'
import { useAppState } from '../context/AppContext'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/institutions', label: 'Institutions', icon: Building2 },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/analysis', label: 'Analysis', icon: BarChart2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const { dbReady } = useAppState()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-slate-800 z-30 flex items-center px-4 gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-white font-semibold text-lg shrink-0"
          aria-label="HE Tracker home"
        >
          <GraduationCap size={22} className="text-green-400" />
          <span className={collapsed ? 'hidden' : ''}>HE Tracker</span>
        </button>
        <div className="flex-1 max-w-lg mx-auto">
          <div className="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-1.5 text-slate-400 text-sm">
            <Search size={14} />
            <span>Search institutions, documents…</span>
          </div>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="text-slate-400 hover:text-white ml-auto"
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>
      </header>

      <div className="flex flex-1 pt-14">
        {/* Sidebar */}
        <nav
          aria-label="Main navigation"
          className={`${collapsed ? 'w-14' : 'w-56'} bg-slate-800 flex flex-col shrink-0 transition-all duration-200 fixed left-0 top-14 bottom-0 z-20`}
        >
          <div className="flex-1 py-4 overflow-y-auto">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                aria-current={undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-green-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`
                }
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </div>

          {/* DB status + collapse */}
          <div className="border-t border-slate-700 p-3">
            {!collapsed && (
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2 px-1">
                <Database size={12} />
                <span>{dbReady ? 'DB Ready' : 'Loading…'}</span>
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-center w-full p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </nav>

        {/* Main content */}
        <main className={`${collapsed ? 'ml-14' : 'ml-56'} flex-1 overflow-auto p-6 transition-all duration-200`}>
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}
