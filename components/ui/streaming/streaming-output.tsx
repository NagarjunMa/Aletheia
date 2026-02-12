'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Copy,
  Download,
  Edit3,
  Check,
  X,
  RotateCcw,
  Sparkles,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StreamingSession } from '@/lib/stores/streaming-store'
import { useToast } from '@/hooks/use-toast'

interface StreamingOutputProps {
  session: StreamingSession
  originalText: string
  onAccept?: (content: string) => void
  onReject?: () => void
  onRegenerate?: () => void
  onEdit?: (content: string) => void
  className?: string
}

export function StreamingOutput({
  session,
  originalText,
  onAccept,
  onReject,
  onRegenerate,
  onEdit,
  className
}: StreamingOutputProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(session.fullContent)
  const { toast } = useToast()

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(session.fullContent)
      toast({
        description: 'Content copied to clipboard',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        description: 'Failed to copy content',
      })
    }
  }

  const downloadAsFile = () => {
    const blob = new Blob([session.fullContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `draft-${session.draftType}-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      description: 'Draft downloaded successfully',
    })
  }

  const handleEditSave = () => {
    if (onEdit) {
      onEdit(editedContent)
    }
    setIsEditing(false)
    toast({
      description: 'Changes saved',
    })
  }

  const handleEditCancel = () => {
    setEditedContent(session.fullContent)
    setIsEditing(false)
  }

  const getDraftTypeInfo = () => {
    if (session.draftType === 'grammar_fix') {
      return {
        label: 'Grammar Fix Only',
        description: 'Corrects grammar, spelling, and punctuation while preserving your voice',
        icon: FileText,
        color: 'bg-blue-500'
      }
    }
    return {
      label: 'Adaptive Polish',
      description: 'Enhanced clarity, style, and engagement while maintaining authenticity',
      icon: Sparkles,
      color: 'bg-purple-500'
    }
  }

  const draftInfo = getDraftTypeInfo()
  const Icon = draftInfo.icon

  if (session.status !== 'completed' && session.status !== 'error') {
    return null
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg text-white', draftInfo.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">{draftInfo.label}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {draftInfo.description}
              </p>
            </div>
          </div>
          <Badge variant={session.status === 'completed' ? 'default' : 'destructive'}>
            {session.status === 'completed' ? 'Ready' : 'Error'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="flex items-center gap-2"
          >
            <Copy className="h-3 w-3" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadAsFile}
            className="flex items-center gap-2"
          >
            <Download className="h-3 w-3" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-2"
          >
            <Edit3 className="h-3 w-3" />
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>
          {onRegenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-3 w-3" />
              Regenerate
            </Button>
          )}
        </div>

        <Separator />

        {/* Content Display/Edit */}
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-40 resize-none"
              placeholder="Edit your content..."
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleEditSave}
                className="flex items-center gap-2"
              >
                <Check className="h-3 w-3" />
                Save Changes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditCancel}
                className="flex items-center gap-2"
              >
                <X className="h-3 w-3" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <div className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap text-sm leading-relaxed">
              {session.fullContent}
            </div>
          </div>
        )}

        {/* Accept/Reject Actions */}
        {(onAccept || onReject) && (
          <>
            <Separator />
            <div className="flex gap-3">
              {onAccept && (
                <Button
                  onClick={() => onAccept(isEditing ? editedContent : session.fullContent)}
                  className="flex items-center gap-2 flex-1"
                >
                  <Check className="h-4 w-4" />
                  Accept Draft
                </Button>
              )}
              {onReject && (
                <Button
                  variant="outline"
                  onClick={onReject}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              )}
            </div>
          </>
        )}

        {/* Original Text Comparison */}
        {originalText && (
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
              Compare with original
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">ORIGINAL</div>
                <div className="bg-muted/20 rounded-lg p-3 text-sm whitespace-pre-wrap">
                  {originalText}
                </div>
              </div>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}