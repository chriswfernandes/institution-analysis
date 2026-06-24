import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useAppDispatch } from './context/AppContext'
import { ProcessingProvider } from './context/ProcessingContext'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Institutions } from './pages/Institutions'
import { InstitutionDetail } from './pages/InstitutionDetail'
import { Documents } from './pages/Documents'
import { Analysis } from './pages/Analysis'
import { ComparisonView } from './pages/ComparisonView'
import { Settings } from './pages/Settings'
import { Admin } from './pages/Admin'
import { ProcessingStatusBar } from './components/ProcessingStatusBar'
import { initDb, clearPersistedDb } from './db/db'
import { GraduationCap } from 'lucide-react'

function AppRoutes() {
  const dispatch = useAppDispatch()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initDb()
      .then(() => dispatch({ type: 'SET_DB_READY' }))
      .catch((e: unknown) => setError(String(e)))
  }, [dispatch])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
          <p className="text-red-600 font-semibold mb-2">Database failed to initialise</p>
          <p className="text-sm text-slate-600 break-words">{error}</p>
          <p className="text-sm text-slate-500 mt-4">
            Try reloading. If local storage is full or the database is corrupt, reset it to a
            fresh, empty database (this deletes locally stored documents and data).
          </p>
          <div className="flex justify-center gap-3 mt-5">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Reload
            </button>
            <button
              onClick={() => { clearPersistedDb(); window.location.reload() }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
            >
              Reset database
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="institutions" element={<Institutions />} />
        <Route path="institutions/compare" element={<ComparisonView />} />
        <Route path="institutions/:id" element={<InstitutionDetail />} />
        <Route path="documents" element={<Documents />} />
        <Route path="analysis" element={<Analysis />} />
        <Route path="admin" element={<Admin />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-800">
      <div className="text-center text-white">
        <GraduationCap size={48} className="text-green-400 mx-auto mb-4 animate-pulse" />
        <p className="text-slate-300 text-sm">Loading HE Tracker…</p>
      </div>
    </div>
  )
}

function AppInner() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Small delay to let the DB init before showing routes
    setReady(true)
  }, [])

  if (!ready) return <LoadingScreen />
  return <AppRoutes />
}

export default function App() {
  return (
    <AppProvider>
      <ProcessingProvider>
        <BrowserRouter>
          <AppInner />
          <ProcessingStatusBar />
        </BrowserRouter>
      </ProcessingProvider>
    </AppProvider>
  )
}
