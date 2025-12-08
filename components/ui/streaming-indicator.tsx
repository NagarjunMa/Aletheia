'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2, Zap, CheckCircle, XCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const streamingIndicatorVariants = cva(
  'inline-flex items-center gap-2',
  {
    variants: {
      variant: {
        default: 'text-sm text-muted-foreground',
        prominent: 'text-base font-medium',
        subtle: 'text-xs text-muted-foreground',
      },
      status: {
        idle: 'text-muted-foreground',
        streaming: 'text-blue-600 dark:text-blue-400',
        completed: 'text-green-600 dark:text-green-400',
        error: 'text-red-600 dark:text-red-400',
      },
    },
    defaultVariants: {
      variant: 'default',
      status: 'idle',
    },
  }
)

export interface StreamingIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof streamingIndicatorVariants> {
  progress?: number
  status?: 'idle' | 'streaming' | 'completed' | 'error'
  message?: string
  showProgress?: boolean
  animated?: boolean
}

const StreamingIndicator = React.forwardRef<HTMLDivElement, StreamingIndicatorProps>(
  ({
    className,
    variant,
    status = 'idle',
    progress = 0,
    message,
    showProgress = false,
    animated = true,
    ...props
  }, ref) => {
    const getIcon = () => {
      switch (status) {
        case 'streaming':
          return <Loader2 className={cn('h-4 w-4', animated && 'animate-spin')} />
        case 'completed':
          return <CheckCircle className="h-4 w-4" />
        case 'error':
          return <XCircle className="h-4 w-4" />
        default:
          return <Zap className="h-4 w-4" />
      }
    }

    const getDefaultMessage = () => {
      switch (status) {
        case 'streaming':
          return 'Processing...'
        case 'completed':
          return 'Completed'
        case 'error':
          return 'Error occurred'
        default:
          return 'Ready'
      }
    }

    const displayMessage = message || getDefaultMessage()

    return (
      <div
        ref={ref}
        className={cn(streamingIndicatorVariants({ variant, status, className }))}
        {...props}
      >
        {getIcon()}
        <span>{displayMessage}</span>
        {showProgress && progress > 0 && (
          <div className="flex items-center gap-2 ml-2">
            <Progress value={progress} className="w-20" />
            <span className="text-xs font-mono">{Math.round(progress)}%</span>
          </div>
        )}
      </div>
    )
  }
)

StreamingIndicator.displayName = 'StreamingIndicator'

export { StreamingIndicator, streamingIndicatorVariants }