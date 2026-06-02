import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[40vh] flex items-center justify-center p-8">
          <div className="bg-white rounded-xl border border-red-200 p-8 max-w-lg text-center shadow">
            <p className="text-red-600 font-semibold text-lg mb-2">Something went wrong</p>
            <p className="text-sm text-slate-500 mb-4">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
