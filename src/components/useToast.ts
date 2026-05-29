import { useAppDispatch } from '../context/AppContext'
import type { Toast } from '../types'

export function useToast() {
  const dispatch = useAppDispatch()

  return function showToast(type: Toast['type'], message: string) {
    dispatch({
      type: 'ADD_TOAST',
      payload: { id: `${Date.now()}-${Math.random()}`, type, message },
    })
  }
}
