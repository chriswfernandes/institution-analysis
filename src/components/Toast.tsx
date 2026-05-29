import { useEffect } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import type { Toast } from '../types'
import { useAppDispatch } from '../context/AppContext'

export function ToastItem({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch()

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', payload: toast.id })
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast.id, dispatch])

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? XCircle : Info

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border shadow-md ${styles[toast.type]} min-w-72 max-w-sm`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="text-sm flex-1">{toast.message}</p>
      <button
        onClick={() => dispatch({ type: 'REMOVE_TOAST', payload: toast.id })}
        className="shrink-0 opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const dispatch = useAppDispatch()
  // Keep dispatch in scope — accessed via ToastItem children
  void dispatch
  return null
}
