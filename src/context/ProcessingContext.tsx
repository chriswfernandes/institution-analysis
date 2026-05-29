import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react'

export type ProcessingStep =
  | 'reading'
  | 'extracting'
  | 'chunking'
  | 'saving'
  | 'classifying'
  | 'awaiting_confirmation'
  | 'extracting_data'
  | 'writing_db'
  | 'complete'
  | 'failed'

export interface ProcessingJob {
  id: string
  fileName: string
  step: ProcessingStep
  progress: number
  error?: string
}

interface ProcessingState {
  jobs: ProcessingJob[]
}

type Action =
  | { type: 'ADD_JOB'; payload: ProcessingJob }
  | { type: 'UPDATE_JOB'; payload: Partial<ProcessingJob> & { id: string } }
  | { type: 'REMOVE_JOB'; payload: string }

function reducer(state: ProcessingState, action: Action): ProcessingState {
  switch (action.type) {
    case 'ADD_JOB':
      return { jobs: [...state.jobs, action.payload] }
    case 'UPDATE_JOB':
      return {
        jobs: state.jobs.map((j) =>
          j.id === action.payload.id ? { ...j, ...action.payload } : j
        ),
      }
    case 'REMOVE_JOB':
      return { jobs: state.jobs.filter((j) => j.id !== action.payload) }
    default:
      return state
  }
}

interface ProcessingContextValue {
  jobs: ProcessingJob[]
  addJob: (job: ProcessingJob) => void
  updateJob: (update: Partial<ProcessingJob> & { id: string }) => void
  removeJob: (id: string) => void
}

const ProcessingCtx = createContext<ProcessingContextValue>({
  jobs: [],
  addJob: () => {},
  updateJob: () => {},
  removeJob: () => {},
})

export function ProcessingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { jobs: [] })

  const addJob = useCallback((job: ProcessingJob) => dispatch({ type: 'ADD_JOB', payload: job }), [])
  const updateJob = useCallback(
    (update: Partial<ProcessingJob> & { id: string }) =>
      dispatch({ type: 'UPDATE_JOB', payload: update }),
    []
  )
  const removeJob = useCallback((id: string) => dispatch({ type: 'REMOVE_JOB', payload: id }), [])

  return (
    <ProcessingCtx.Provider value={{ jobs: state.jobs, addJob, updateJob, removeJob }}>
      {children}
    </ProcessingCtx.Provider>
  )
}

export function useProcessing() {
  return useContext(ProcessingCtx)
}
