'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Save,
  Edit3,
  Zap,
  BarChart3,
  Clock,
  Type,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Smartphone
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRealTimeCPLAnalysis } from '@/lib/query/hooks'
import { useContentActions, useCurrentInput } from '@/lib/stores/content-store'
import { StreamingManager } from './streaming-manager'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/use-debounce'

interface MobileRealTimeEditorProps {
  initialText?: string
  placeholder?: string
  onSave?: (content: string, inputId: string) => void
  className?: string
}

export function MobileRealTimeEditor({
  initialText = '',
  placeholder = 'Start writing...',
  onSave,
  className
}: MobileRealTimeEditorProps) {
  const [text, setText] = useState(initialText)
  const [isSaving, setIsSaving] = useState(false)
  const [showStreaming, setShowStreaming] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [currentInputId, setCurrentInputId] = useState<string>()

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()

  // Debounce text for CPL analysis
  const debouncedText = useDebounce(text, 2000) // Longer debounce on mobile

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
    2000
  )

  // Auto-resize textarea for mobile
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, window.innerHeight * 0.4)
      textarea.style.height = `${newHeight}px`
    }
  }, [text])

  // Create/update input when text changes
  useEffect(() => {
    if (text.length >= 10) {
      if (!currentInputId) {
        const inputId = createInput({
          originalText: text,
          category: 'draft',
          metadata: {
            createdAt: new Date().toISOString(),
            source: 'mobile-editor'
          }
        })
        setCurrentInputId(inputId)
      } else {
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
          source: 'mobile-editor'
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
          source: 'mobile-editor'
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
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length
  const readTime = Math.ceil(wordCount / 200)

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Editor Card - Mobile Optimized */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Editor
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* CPL Score - Compact */}
              {cplAnalysis && (
                <>
                  <Badge variant="outline" className="text-xs">
                    {cplScore}
                  </Badge>
                  <Badge className={cn('text-white text-xs px-2', cplFormat.color)}>
                    {cplFormat.label}
                  </Badge>
                </>
              )}

              {/* Analysis Status */}
              {isAnalyzing && (
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Main Text Area - Mobile Optimized */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              className="min-h-32 resize-none text-base leading-relaxed border-2 focus:border-primary"
              rows={6}
            />

            {/* Character Count - Mobile positioned */}
            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/90 px-2 py-1 rounded">
              {text.length}
            </div>
          </div>

          {/* Action Buttons - Mobile Layout */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || !text.trim()}
                className="flex items-center gap-2 flex-1"
                size="sm"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>

              <Button
                onClick={handleStartStreaming}
                disabled={!text.trim() || text.length < 10}
                variant="secondary"
                className="flex items-center gap-2 flex-1"
                size="sm"
              >
                <Zap className="h-4 w-4" />
                Generate
              </Button>
            </div>

            {/* Mobile Toggle Buttons */}
            <div className="flex gap-2 text-xs">
              <Button
                onClick={() => setShowAnalysis(!showAnalysis)}
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 flex-1"
              >
                <BarChart3 className="h-3 w-3" />
                Analysis
                {showAnalysis ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>

              <Button
                onClick={() => setShowStats(!showStats)}
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 flex-1"
              >
                <Type className="h-3 w-3" />
                Stats
                {showStats ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>

              <Button
                onClick={() => setShowStreaming(!showStreaming)}
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 flex-1"
              >
                <Smartphone className="h-3 w-3" />
                Stream
                {showStreaming ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CPL Analysis - Collapsible Mobile */}
      <Collapsible open={showAnalysis} onOpenChange={setShowAnalysis}>
        <CollapsibleContent>
          {cplAnalysis && !isAnalyzing && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Content Analysis</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-muted/30 rounded p-2">
                      <div className="text-muted-foreground text-xs">Grammar</div>
                      <div className="font-medium">{cplAnalysis.grammarScore || 0}</div>
                    </div>
                    <div className="bg-muted/30 rounded p-2">
                      <div className="text-muted-foreground text-xs">Clarity</div>
                      <div className="font-medium">{cplAnalysis.clarityScore || 0}</div>
                    </div>
                    <div className="bg-muted/30 rounded p-2">
                      <div className="text-muted-foreground text-xs">Style</div>
                      <div className="font-medium">{cplAnalysis.styleScore || 0}</div>
                    </div>
                    <div className="bg-muted/30 rounded p-2">
                      <div className="text-muted-foreground text-xs">Engagement</div>
                      <div className="font-medium">{cplAnalysis.engagementScore || 0}</div>
                    </div>
                  </div>

                  {cplAnalysis.suggestions && cplAnalysis.suggestions.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground">
                        Suggestions ({cplAnalysis.suggestions.length})
                        <ChevronDown className="h-3 w-3" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-1">
                        {cplAnalysis.suggestions.slice(0, 2).map((suggestion: string, index: number) => (
                          <div key={index} className="text-xs text-muted-foreground bg-muted/20 rounded px-2 py-1">
                            • {suggestion}
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Quick Stats - Collapsible Mobile */}
      <Collapsible open={showStats} onOpenChange={setShowStats}>
        <CollapsibleContent>
          {text.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-muted/30 rounded p-3">
                    <div className="text-lg font-medium">{wordCount}</div>
                    <div className="text-xs text-muted-foreground">Words</div>
                  </div>
                  <div className="bg-muted/30 rounded p-3">
                    <div className="text-lg font-medium">{readTime}</div>
                    <div className="text-xs text-muted-foreground">Min read</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Streaming Manager - Collapsible Mobile */}
      <Collapsible open={showStreaming} onOpenChange={setShowStreaming}>
        <CollapsibleContent>
          <StreamingManager
            inputId={currentInputId}
            originalText={text}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}