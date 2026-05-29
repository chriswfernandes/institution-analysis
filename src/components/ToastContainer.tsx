import { useAppState } from '../context/AppContext'
import { ToastItem } from './Toast'

export function ToastContainer() {
  const { toasts } = useAppState()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
