'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getCPLScoreColor, getCPLScoreLabel } from '@/lib/design-system'

const cplScoreVariants = cva(
  'inline-flex items-center justify-center gap-2',
  {
    variants: {
      variant: {
        default: 'flex-col items-start space-y-2',
        inline: 'flex-row items-center',
        badge: 'flex-row items-center',
        detailed: 'flex-col items-start space-y-3',
      },
      size: {
        sm: 'text-sm',
        default: 'text-base',
        lg: 'text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface CPLScoreProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof cplScoreVariants> {
  score: number
  showProgress?: boolean
  showBadge?: boolean
  showLabel?: boolean
  animated?: boolean
}

const CPLScore = React.forwardRef<HTMLDivElement, CPLScoreProps>(
  ({
    className,
    variant,
    size,
    score,
    showProgress = true,
    showBadge = false,
    showLabel = true,
    animated = true,
    ...props
  }, ref) => {
    const [displayScore, setDisplayScore] = React.useState(animated ? 0 : score)

    React.useEffect(() => {
      if (animated) {
        // Start animation from current displayScore to new score
        const startScore = displayScore
        const duration = 1000 // 1 second
        const steps = 60 // 60 FPS
        const increment = (score - startScore) / steps
        const stepDuration = duration / steps

        let currentStep = 0
        const interval = setInterval(() => {
          currentStep++
          if (currentStep >= steps) {
            clearInterval(interval)
            setDisplayScore(score)
          } else {
            setDisplayScore(startScore + increment * currentStep)
          }
        }, stepDuration)

        return () => clearInterval(interval)
      } else {
        setDisplayScore(score)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [score, animated])

    const scoreColor = getCPLScoreColor(score)
    const scoreLabel = getCPLScoreLabel(score)
    const normalizedScore = Math.min(Math.max(score, 0), 100)

    const renderScore = () => (
      <div className="font-semibold" style={{ color: scoreColor }}>
        {Math.round(displayScore)}/100
      </div>
    )

    const renderLabel = () => showLabel && (
      <div className="text-sm text-muted-foreground">
        {scoreLabel}
      </div>
    )

    const renderBadge = () => showBadge && (
      <Badge
        variant="secondary"
        style={{
          backgroundColor: scoreColor + '20',
          color: scoreColor,
          borderColor: scoreColor + '40'
        }}
      >
        {scoreLabel}
      </Badge>
    )

    const renderProgress = () => showProgress && (
      <Progress
        value={displayScore}
        className="w-full"
        style={{
          '--progress-foreground': scoreColor
        } as React.CSSProperties}
      />
    )

    if (variant === 'badge') {
      return (
        <div
          ref={ref}
          className={cn(cplScoreVariants({ variant, size, className }))}
          {...props}
        >
          {renderScore()}
          {renderBadge()}
        </div>
      )
    }

    if (variant === 'inline') {
      return (
        <div
          ref={ref}
          className={cn(cplScoreVariants({ variant, size, className }))}
          {...props}
        >
          {renderScore()}
          {renderLabel()}
        </div>
      )
    }

    if (variant === 'detailed') {
      return (
        <div
          ref={ref}
          className={cn(cplScoreVariants({ variant, size, className }))}
          {...props}
        >
          <div className="flex items-center justify-between w-full">
            {renderScore()}
            {renderBadge()}
          </div>
          {renderProgress()}
          {renderLabel()}
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(cplScoreVariants({ variant, size, className }))}
        {...props}
      >
        {renderScore()}
        {renderProgress()}
        {renderLabel()}
      </div>
    )
  }
)

CPLScore.displayName = 'CPLScore'

export { CPLScore, cplScoreVariants }