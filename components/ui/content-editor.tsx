'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Download, RefreshCw, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CPLScore } from '@/components/ui/cpl-score'
import { StreamingIndicator } from '@/components/ui/streaming-indicator'

const contentEditorVariants = cva(
  'rounded-lg border bg-card text-card-foreground shadow-sm',
  {
    variants: {
      variant: {
        default: 'border-border',
        enhanced: 'border-primary/20 bg-primary/5',
        focus: 'border-primary ring-1 ring-primary/20',
      },
      size: {
        sm: 'p-3',
        default: 'p-4',
        lg: 'p-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ContentEditorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof contentEditorVariants> {
  content: string
  onContentChange?: (content: string) => void
  placeholder?: string
  readOnly?: boolean
  cplScore?: number
  isStreaming?: boolean
  streamingProgress?: number
  streamingMessage?: string
  draftType?: 'grammar_fix' | 'adaptive_polish'
  onCopy?: () => void
  onDownload?: () => void
  onRegenerate?: () => void
  onEnhance?: () => void
  showActions?: boolean
  showCPL?: boolean
  minRows?: number
  maxRows?: number
}

const ContentEditor = React.forwardRef<HTMLDivElement, ContentEditorProps>(
  ({
    className,
    variant,
    size,
    content,
    onContentChange,
    placeholder = 'Enter your content here...',
    readOnly = false,
    cplScore,
    isStreaming = false,
    streamingProgress,
    streamingMessage,
    draftType,
    onCopy,
    onDownload,
    onRegenerate,
    onEnhance,
    showActions = true,
    showCPL = true,
    minRows = 6,
    maxRows = 20,
    ...props
  }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)
    const [wordCount, setWordCount] = React.useState(0)
    const [charCount, setCharCount] = React.useState(0)

    React.useEffect(() => {
      if (content) {
        const words = content.trim().split(/\s+/).length
        setWordCount(content.trim() === '' ? 0 : words)
        setCharCount(content.length)
      } else {
        setWordCount(0)
        setCharCount(0)
      }
    }, [content])

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value
      onContentChange?.(newContent)
    }

    const handleCopy = async () => {
      if (content && navigator.clipboard) {
        await navigator.clipboard.writeText(content)
        onCopy?.()
      }
    }

    const adjustTextareaHeight = () => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = 'auto'
        const scrollHeight = textarea.scrollHeight
        const lineHeight = 24 // Approximate line height in pixels
        const minHeight = minRows * lineHeight
        const maxHeight = maxRows * lineHeight
        const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
        textarea.style.height = `${newHeight}px`
      }
    }

    React.useEffect(() => {
      adjustTextareaHeight()
    }, [content, minRows, maxRows])

    return (
      <div
        ref={ref}
        className={cn(contentEditorVariants({ variant, size, className }))}
        {...props}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {draftType && (
              <Badge variant="outline">
                {draftType === 'grammar_fix' ? 'Grammar Fix' : 'Adaptive Polish'}
              </Badge>
            )}
            {isStreaming && (
              <StreamingIndicator
                status="streaming"
                progress={streamingProgress}
                message={streamingMessage}
                showProgress={!!streamingProgress}
              />
            )}
          </div>

          {showCPL && cplScore !== undefined && (
            <CPLScore
              score={cplScore}
              variant="inline"
              size="sm"
              showProgress={false}
              showBadge={true}
            />
          )}
        </div>

        {/* Content Area */}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder={placeholder}
            readOnly={readOnly || isStreaming}
            className={cn(
              'resize-none overflow-hidden border-0 bg-transparent p-0 focus-visible:ring-0',
              isStreaming && 'opacity-70'
            )}
            style={{ minHeight: `${minRows * 24}px` }}
          />

          {/* Streaming overlay */}
          {isStreaming && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md">
              <StreamingIndicator
                status="streaming"
                variant="prominent"
                message={streamingMessage}
                progress={streamingProgress}
                showProgress={true}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{wordCount} words</span>
            <span>{charCount} characters</span>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex items-center gap-2">
              {content && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    disabled={isStreaming}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>

                  {onDownload && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onDownload}
                      disabled={isStreaming}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  )}
                </>
              )}

              {onRegenerate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRegenerate}
                  disabled={isStreaming}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate
                </Button>
              )}

              {onEnhance && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onEnhance}
                  disabled={isStreaming || !content.trim()}
                >
                  <Wand2 className="h-4 w-4 mr-1" />
                  Enhance
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
)

ContentEditor.displayName = 'ContentEditor'

export { ContentEditor, contentEditorVariants }