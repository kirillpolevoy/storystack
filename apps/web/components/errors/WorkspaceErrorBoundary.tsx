'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary for workspace-related errors
 * Provides fallback UI and error recovery
 */
export class WorkspaceErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[WorkspaceErrorBoundary] Caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    
    // Clear workspace from localStorage and reload
    if (typeof window !== 'undefined') {
      localStorage.removeItem('@storystack:active_workspace_id')
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex h-screen flex-col items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900">Workspace Error</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Something went wrong while loading your workspace. This might be due to a network issue or invalid workspace data.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="text-xs text-gray-500 cursor-pointer mb-2">Error details</summary>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-3">
              <Button onClick={this.handleReset} variant="default" className="flex-1">
                Reset & Reload
              </Button>
              <Button onClick={() => this.setState({ hasError: false, error: null })} variant="outline" className="flex-1">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

