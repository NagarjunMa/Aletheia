'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Save,
  Edit3,
  Zap,
  BarChart3,
  Clock,
  Type,
  Eye,
  EyeOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRealTimeCPLAnalysis } from '@/lib/query/hooks'
import { useContentActions, useCurrentInput } from '@/lib/stores/content-store'
import { StreamingManager } from './streaming-manager'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/use-debounce'

interface RealTimeEditorProps {
  initialText?: string
  placeholder?: string
  onSave?: (content: string, inputId: string) => void
  className?: string
}

export function RealTimeEditor({
  initialText = '',
  placeholder = 'Start writing...',
  onSave,
  className
}: RealTimeEditorProps) {
  const [text, setText] = useState(initialText)
  const [isSaving, setIsSaving] = useState(false)
  const [showStreaming, setShowStreaming] = useState(false)
  const [currentInputId, setCurrentInputId] = useState<string>()

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()

  // Debounce text for CPL analysis
  const debouncedText = useDebounce(text, 1500)

  // Content store actions
  const { createInput, updateInput } = useContentActions()
  const currentInput = useCurrentInput()

  // Real-time CPL analysis
  const {
    data: cplAnalysis,
    isAnalyzing,
    isLoading: isCPLLoading,
    error: cplError
  } = useRealTimeCPLAnalysis(
    debouncedText,
    {
      detailedAnalysis: true,
      cacheResults: true
    },
    1500
  )

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [text])

  // Create/update input when text changes
  useEffect(() => {
    if (text.length >= 10) {
      if (!currentInputId) {
        // Create new input
        const inputId = createInput({
          originalText: text,
          category: 'draft',
          metadata: {
            createdAt: new Date().toISOString(),
            source: 'editor'
          }
        })
        setCurrentInputId(inputId)
      } else {
        // Update existing input
        updateInput(currentInputId, {
          originalText: text,
          updatedAt: new Date().toISOString()
        })
      }
    }
  }, [debouncedText, currentInputId, createInput, updateInput])

  const handleSave = async () => {
    if (!text.trim()) {
      toast({
        variant: 'destructive',
        description: 'Please enter some text before saving',
      })
      return
    }

    setIsSaving(true)
    try {
      const inputId = currentInputId || createInput({
        originalText: text,
        category: 'draft',
        metadata: {
          createdAt: new Date().toISOString(),
          source: 'editor'
        }
      })

      if (onSave) {
        await onSave(text, inputId)
      }

      toast({
        description: 'Content saved successfully',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        description: 'Failed to save content',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleStartStreaming = () => {
    if (!text.trim()) {
      toast({
        variant: 'destructive',
        description: 'Please enter some text before starting streaming',
      })
      return
    }

    if (!currentInputId) {
      const inputId = createInput({
        originalText: text,
        category: 'draft',
        metadata: {
          createdAt: new Date().toISOString(),
          source: 'editor'
        }
      })
      setCurrentInputId(inputId)
    }

    setShowStreaming(true)
  }

  const formatCPLScore = (score: number) => {
    if (score >= 85) return { label: 'Excellent', color: 'bg-green-500' }
    if (score >= 70) return { label: 'Good', color: 'bg-blue-500' }
    if (score >= 55) return { label: 'Fair', color: 'bg-yellow-500' }
    return { label: 'Needs Work', color: 'bg-red-500' }
  }

  const cplScore = cplAnalysis?.overallScore || 0
  const cplFormat = formatCPLScore(cplScore)

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* Editor Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Real-time Editor
            </CardTitle>
            <div className="flex items-center gap-3">
              {/* CPL Score */}
              {cplAnalysis && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    CPL: {cplScore}
                  </Badge>
                  <Badge className={cn('text-white text-xs', cplFormat.color)}>
                    {cplFormat.label}
                  </Badge>
                </div>
              )}

              {/* Analysis Status */}
              {isAnalyzing && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  Analyzing...
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Main Text Area */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              className="min-h-32 resize-none text-base leading-relaxed"
              rows={8}
            />

            {/* Character Count */}
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
              {text.length} characters
            </div>
          </div>

          {/* CPL Analysis Display */}
          {cplAnalysis && !isAnalyzing && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Content Analysis</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Grammar</div>
                  <div className="font-medium">{cplAnalysis.grammarScore || 0}/100</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Clarity</div>
                  <div className="font-medium">{cplAnalysis.clarityScore || 0}/100</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Style</div>
                  <div className="font-medium">{cplAnalysis.styleScore || 0}/100</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Engagement</div>
                  <div className="font-medium">{cplAnalysis.engagementScore || 0}/100</div>
                </div>
              </div>

              {cplAnalysis.suggestions && cplAnalysis.suggestions.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                    View suggestions ({cplAnalysis.suggestions.length})
                  </summary>
                  <div className="mt-2 space-y-1">
                    {cplAnalysis.suggestions.slice(0, 3).map((suggestion: string, index: number) => (
                      <div key={index} className="text-xs text-muted-foreground bg-background/50 rounded px-2 py-1">
                        • {suggestion}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || !text.trim()}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>

              <Button
                onClick={handleStartStreaming}
                disabled={!text.trim() || text.length < 10}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Generate Drafts
              </Button>
            </div>

            <Button
              onClick={() => setShowStreaming(!showStreaming)}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
            >
              {showStreaming ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showStreaming ? 'Hide' : 'Show'} Streaming
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Streaming Manager */}
      {showStreaming && (
        <StreamingManager
          inputId={currentInputId}
          originalText={text}
        />
      )}

      {/* Quick Stats */}
      {text.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-lg font-medium">{text.split(/\s+/).filter(w => w.length > 0).length}</div>
                  <div className="text-xs text-muted-foreground">Words</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-lg font-medium">{Math.ceil(text.split(/\s+/).length / 200)}</div>
                  <div className="text-xs text-muted-foreground">Min read</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-lg font-medium">{cplScore}</div>
                  <div className="text-xs text-muted-foreground">CPL Score</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-lg font-medium">{text.length}</div>
                  <div className="text-xs text-muted-foreground">Characters</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}