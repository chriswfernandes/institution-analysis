import { createContext, useContext, useReducer, useEffect, type Dispatch, type ReactNode } from 'react'
import type { Institution, Tag, Toast, DocumentRow } from '../types'
import { query } from '../db/db'
import { getAllDocuments } from '../db/documentDb'

interface AppState {
  institutions: Institution[]
  tags: Tag[]
  documents: DocumentRow[]
  dbReady: boolean
  toasts: Toast[]
}

type Action =
  | { type: 'SET_INSTITUTIONS'; payload: Institution[] }
  | { type: 'SET_TAGS'; payload: Tag[] }
  | { type: 'SET_DOCUMENTS'; payload: DocumentRow[] }
  | { type: 'SET_DB_READY' }
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: string }

const initialState: AppState = {
  institutions: [],
  tags: [],
  documents: [],
  dbReady: false,
  toasts: [],
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_INSTITUTIONS':
      return { ...state, institutions: action.payload }
    case 'SET_TAGS':
      return { ...state, tags: action.payload }
    case 'SET_DOCUMENTS':
      return { ...state, documents: action.payload }
    case 'SET_DB_READY':
      return { ...state, dbReady: true }
    case 'ADD_TOAST': {
      const now = Date.now()
      const isDuplicate = state.toasts.some(
        (t) => t.message === action.payload.message && now - parseInt(t.id, 10) < 2000
      )
      if (isDuplicate) return state
      return { ...state, toasts: [...state.toasts, action.payload] }
    }
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) }
    default:
      return state
  }
}

const StateCtx = createContext<AppState>(initialState)
const DispatchCtx = createContext<Dispatch<Action>>(() => {})

function AppProviderInner({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    if (!state.dbReady) return
    const institutions = query<Institution>(
      `SELECT i.*, COUNT(d.id) as document_count FROM institutions i
       LEFT JOIN documents d ON d.institution_id = i.id
       GROUP BY i.id ORDER BY i.name`
    )
    dispatch({ type: 'SET_INSTITUTIONS', payload: institutions })

    const tags = query<Tag>('SELECT * FROM tags ORDER BY name')
    dispatch({ type: 'SET_TAGS', payload: tags })

    const documents = getAllDocuments()
    dispatch({ type: 'SET_DOCUMENTS', payload: documents })
  }, [state.dbReady])

  return (
    <DispatchCtx.Provider value={dispatch}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </DispatchCtx.Provider>
  )
}

export function AppProvider({ children }: { children: ReactNode }) {
  return <AppProviderInner>{children}</AppProviderInner>
}

export function useAppState() {
  return useContext(StateCtx)
}

export function useAppDispatch() {
  return useContext(DispatchCtx)
}
