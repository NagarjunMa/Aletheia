'use client'

import React, { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  errorId: string
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  showDetails?: boolean
  level?: 'page' | 'component' | 'critical'
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryCount = 0
  private maxRetries = 3

  constructor(props: ErrorBoundaryProps) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Log error to analytics service
    this.logError(error, errorInfo)

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  private logError = async (error: Error, errorInfo: React.ErrorInfo) => {
    try {
      // In production, send to error tracking service (Sentry, LogRocket, etc.)
      const errorData = {
        error_id: this.state.errorId,
        message: error.message,
        stack: error.stack,
        component_stack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        url: window.location.href,
        level: this.props.level || 'component'
      }

      console.error('Error Boundary caught an error:', errorData)

      // Send to monitoring service
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/errors/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorData)
        }).catch(console.error)
      }
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: ''
      })
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Different UI based on error level
      return this.renderErrorUI()
    }

    return this.props.children
  }

  private renderErrorUI() {
    const { level = 'component', showDetails = false } = this.props
    const { error, errorId } = this.state

    if (level === 'critical') {
      return this.renderCriticalError()
    }

    if (level === 'page') {
      return this.renderPageError()
    }

    return this.renderComponentError()
  }

  private renderCriticalError() {
    return (
      <div className="min-h-screen bg-ascendia-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-red-950/20 border-red-500/30">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <CardTitle className="text-white text-xl">Critical System Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-200">
              A critical error has occurred. The application needs to be reloaded.
            </p>
            <p className="text-sm text-gray-400">
              Error ID: {this.state.errorId}
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={this.handleReload}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload App
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  private renderPageError() {
    return (
      <div className="min-h-screen bg-ascendia-black flex items-center justify-center p-4">
        <Card className="max-w-lg w-full bg-ascendia-gray border-ascendia-gray-light">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-ascendia-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bug className="w-8 h-8 text-ascendia-accent" />
            </div>
            <CardTitle className="text-white text-xl">Page Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-200">
              Something went wrong on this page. You can try refreshing or go back to the homepage.
            </p>

            {this.props.showDetails && this.state.error && (
              <details className="text-left bg-ascendia-black p-3 rounded border border-ascendia-gray-light">
                <summary className="text-gray-400 cursor-pointer mb-2">Error Details</summary>
                <pre className="text-xs text-red-400 overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <p className="text-sm text-gray-400">
              Error ID: {this.state.errorId}
            </p>

            <div className="flex gap-2 justify-center">
              {this.retryCount < this.maxRetries && (
                <Button
                  onClick={this.handleRetry}
                  variant="outline"
                  className="border-ascendia-accent text-ascendia-accent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again ({this.maxRetries - this.retryCount} left)
                </Button>
              )}
              <Button
                onClick={this.handleGoHome}
                className="bg-ascendia-accent hover:bg-ascendia-accent-dim text-black"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  private renderComponentError() {
    return (
      <Card className="bg-yellow-950/20 border-yellow-500/30 my-4">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-yellow-100 font-medium mb-1">
                Component Error
              </p>
              <p className="text-yellow-200 text-sm mb-3">
                This component encountered an error and couldn't render properly.
              </p>

              {this.props.showDetails && this.state.error && (
                <details className="mb-3">
                  <summary className="text-yellow-300 cursor-pointer text-sm">
                    Show error details
                  </summary>
                  <pre className="text-xs text-yellow-400 mt-2 bg-yellow-950/30 p-2 rounded overflow-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}

              <div className="flex gap-2">
                {this.retryCount < this.maxRetries && (
                  <Button
                    onClick={this.handleRetry}
                    size="sm"
                    variant="outline"
                    className="border-yellow-500 text-yellow-300 hover:bg-yellow-500/10"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                )}
                <span className="text-xs text-yellow-400 self-center">
                  ID: {this.state.errorId.slice(-8)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

// Hook for triggering error boundary programmatically
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: any) => {
    // In React 18+, we can trigger error boundary by throwing in an effect
    throw error
  }, [])
}

// Specialized error boundaries for specific use cases
export function ChatErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="component"
      showDetails={process.env.NODE_ENV === 'development'}
      onError={(error) => {
        // Special handling for chat errors
        console.error('Chat error:', error)
      }}
      fallback={
        <Card className="bg-red-950/20 border-red-500/30 my-4">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-100 font-medium">Chat Unavailable</p>
            <p className="text-red-200 text-sm mt-1">
              The chat interface encountered an error. Please refresh the page.
            </p>
            <Button
              onClick={() => window.location.reload()}
              size="sm"
              className="mt-3 bg-red-600 hover:bg-red-700 text-white"
            >
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

export function DraftErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="component"
      showDetails={false}
      fallback={
        <div className="p-4 bg-orange-950/20 border border-orange-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-orange-100">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <span className="font-medium">Draft Generation Error</span>
          </div>
          <p className="text-orange-200 text-sm mt-1">
            Unable to generate drafts. Please try again.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

// Database-specific error boundary with connection state awareness
export function DatabaseErrorBoundary({ children }: { children: ReactNode }) {
  const [connectionState, setConnectionState] = React.useState<'checking' | 'online' | 'offline' | 'error'>('checking')

  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        // Import connection utilities
        const { getConnectionState, isOfflineMode } = await import('@/lib/supabase/client')

        const state = getConnectionState()
        if (isOfflineMode()) {
          setConnectionState('offline')
        } else if (state.isOnline) {
          setConnectionState('online')
        } else {
          setConnectionState('error')
        }
      } catch {
        setConnectionState('error')
      }
    }

    checkConnection()
    const interval = setInterval(checkConnection, 10000) // Check every 10 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <ErrorBoundary
      level="component"
      showDetails={process.env.NODE_ENV === 'development'}
      onError={(error) => {
        // Log database-specific errors
        if (error.message.toLowerCase().includes('supabase') ||
            error.message.toLowerCase().includes('database') ||
            error.message.toLowerCase().includes('enotfound')) {
          console.error('🗄️ Database Error:', {
            error: error.message,
            connectionState,
            timestamp: new Date().toISOString()
          })
        }
      }}
      fallback={
        <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-red-100">Database Connection Issue</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  connectionState === 'offline' ? 'bg-yellow-500/20 text-yellow-300' :
                  connectionState === 'error' ? 'bg-red-500/20 text-red-300' :
                  connectionState === 'online' ? 'bg-green-500/20 text-green-300' :
                  'bg-gray-500/20 text-gray-300'
                }`}>
                  {connectionState === 'checking' ? 'Checking...' :
                   connectionState === 'offline' ? 'Offline Mode' :
                   connectionState === 'error' ? 'Connection Error' : 'Online'}
                </span>
              </div>
              <p className="text-red-200 text-sm mb-2">
                {connectionState === 'offline'
                  ? 'The app is running in offline mode. Some features may be limited.'
                  : 'Unable to connect to the database. Please check your connection and try again.'}
              </p>
              <Button
                onClick={() => window.location.reload()}
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

// Network error boundary for fetch/API errors
export function NetworkErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="component"
      onError={(error) => {
        if (error.message.toLowerCase().includes('fetch') ||
            error.message.toLowerCase().includes('network') ||
            error.message.toLowerCase().includes('timeout')) {
          console.error('🌐 Network Error:', error.message)
        }
      }}
      fallback={
        <div className="p-4 bg-blue-950/20 border border-blue-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-blue-100">
            <AlertTriangle className="w-5 h-5 text-blue-400" />
            <span className="font-medium">Network Error</span>
          </div>
          <p className="text-blue-200 text-sm mt-1 mb-3">
            Unable to reach the server. Check your internet connection.
          </p>
          <Button
            onClick={() => window.location.reload()}
            size="sm"
            variant="outline"
            className="border-blue-500 text-blue-300 hover:bg-blue-500/10"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Try Again
          </Button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}