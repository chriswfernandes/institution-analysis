import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import type { Institution, Tag, Toast } from '../types'

interface AppState {
  institutions: Institution[]
  tags: Tag[]
  dbReady: boolean
  toasts: Toast[]
}

type Action =
  | { type: 'SET_INSTITUTIONS'; payload: Institution[] }
  | { type: 'SET_TAGS'; payload: Tag[] }
  | { type: 'SET_DB_READY' }
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: string }

const initialState: AppState = {
  institutions: [],
  tags: [],
  dbReady: false,
  toasts: [],
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_INSTITUTIONS':
      return { ...state, institutions: action.payload }
    case 'SET_TAGS':
      return { ...state, tags: action.payload }
    case 'SET_DB_READY':
      return { ...state, dbReady: true }
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] }
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) }
    default:
      return state
  }
}

const StateCtx = createContext<AppState>(initialState)
const DispatchCtx = createContext<Dispatch<Action>>(() => {})

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <DispatchCtx.Provider value={dispatch}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </DispatchCtx.Provider>
  )
}

export function useAppState() {
  return useContext(StateCtx)
}

export function useAppDispatch() {
  return useContext(DispatchCtx)
}
