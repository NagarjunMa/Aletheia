'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Draft, useChatStore } from '@/lib/stores/chat-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Check, X, Copy, Edit3, Sparkles, Zap, Brain, Target, Gauge, Award, TrendingUp } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass'

interface DraftDisplayProps {
  drafts: Draft[]
  isStreaming?: boolean
  progress?: { grammar: number; polish: number }
}

export function DraftDisplay({ drafts, isStreaming = false, progress = { grammar: 0, polish: 0 } }: DraftDisplayProps) {
  const { acceptDraft, rejectDraft } = useChatStore()
  const [editingDraft, setEditingDraft] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleAccept = async (draftId: string, userEdits?: string) => {
    try {
      await acceptDraft(draftId, userEdits)
      setEditingDraft(null)
    } catch (error) {
      console.error('Failed to accept draft:', error)
    }
  }

  const handleReject = async (draftId: string) => {
    try {
      await rejectDraft(draftId)
    } catch (error) {
      console.error('Failed to reject draft:', error)
    }
  }

  const handleCopy = async (content: string, draftId: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(draftId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const startEditing = (draft: Draft) => {
    setEditingDraft(draft.id)
    setEditContent(draft.content)
  }

  const cancelEditing = () => {
    setEditingDraft(null)
    setEditContent('')
  }

  const saveEdits = () => {
    if (editingDraft) {
      handleAccept(editingDraft, editContent)
    }
  }

  if (drafts.length === 0) return null

  return (
    <motion.div
      className="space-y-6 p-6"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, staggerChildren: 0.1 }}
    >
      {/* Enhanced Header with AI Status */}
      <motion.div
        className="relative"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <GlassCard variant="elevated" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <motion.div
                className="w-12 h-12 bg-gradient-to-br from-aletheia-gold to-aletheia-gold-dark rounded-xl flex items-center justify-center"
                animate={isStreaming ? {
                  scale: [1, 1.1, 1],
                  rotate: [0, 360]
                } : {}}
                transition={{ duration: 2, repeat: isStreaming ? Infinity : 0 }}
              >
                <Brain className="w-6 h-6 text-aletheia-bg" />
              </motion.div>

              <div>
                <h3 className="text-xl font-bold text-aletheia-text bg-gradient-to-r from-aletheia-text to-aletheia-gold bg-clip-text text-transparent">
                  {isStreaming ? 'AI Intelligence Processing...' : 'Content Variants Generated'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-aletheia-gold/20 text-aletheia-gold border border-aletheia-gold/40 backdrop-blur-sm">
                    {drafts.length} Version{drafts.length === 1 ? '' : 's'}
                  </Badge>
                  {isStreaming && (
                    <Badge className="bg-aletheia-info/20 text-aletheia-info border border-aletheia-info/40 backdrop-blur-sm animate-pulse">
                      <Zap className="w-3 h-3 mr-1" />
                      Live Processing
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <motion.div
              className="flex items-center gap-2"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
            >
              <div className="w-3 h-3 bg-aletheia-success rounded-full animate-pulse-glow" />
              <span className="text-aletheia-text-muted text-sm">Aletheia Active</span>
            </motion.div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Advanced Streaming Progress */}
      <AnimatePresence>
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard variant="glow" className="p-6">
              <div className="space-y-6">
                <div className="text-center mb-4">
                  <motion.div
                    className="inline-flex items-center gap-2 text-aletheia-gold"
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="w-5 h-5 animate-spin" />
                    <span className="text-lg font-semibold">Neural Networks Processing</span>
                  </motion.div>
                </div>

                {/* Grammar Fix Progress */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-aletheia-info to-aletheia-info/70 rounded-lg flex items-center justify-center">
                        <Target className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-medium text-aletheia-text">Grammar Enhancement</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.span
                        className="text-aletheia-gold font-bold text-lg"
                        key={progress.grammar}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                      >
                        {progress.grammar}%
                      </motion.span>
                    </div>
                  </div>
                  <div className="relative w-full h-3 bg-aletheia-glass rounded-full overflow-hidden border border-aletheia-glass-border">
                    <motion.div
                      className="h-full bg-gradient-to-r from-aletheia-info to-aletheia-info/80 rounded-full relative overflow-hidden"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.grammar}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 animate-shimmer" />
                    </motion.div>
                  </div>
                </div>

                {/* Polish Progress */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-aletheia-success to-aletheia-success/70 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-medium text-aletheia-text">Adaptive Polish</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <motion.span
                        className="text-aletheia-gold font-bold text-lg"
                        key={progress.polish}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                      >
                        {progress.polish}%
                      </motion.span>
                    </div>
                  </div>
                  <div className="relative w-full h-3 bg-aletheia-glass rounded-full overflow-hidden border border-aletheia-glass-border">
                    <motion.div
                      className="h-full bg-gradient-to-r from-aletheia-success to-aletheia-success/80 rounded-full relative overflow-hidden"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.polish}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 animate-shimmer" />
                    </motion.div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advanced Draft Grid */}
      <motion.div
        className="grid gap-6 md:grid-cols-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, staggerChildren: 0.1 }}
      >
        <AnimatePresence>
          {drafts.map((draft, index) => (
            <motion.div
              key={draft.id}
              initial={{ opacity: 0, y: 50, rotateX: -15 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -50, rotateX: 15 }}
              transition={{
                delay: index * 0.1,
                duration: 0.5,
                type: "spring",
                damping: 20
              }}
              whileHover={{ y: -5, scale: 1.02 }}
            >
              <GlassCard
                variant={draft.is_accepted === true ? "glow" : "elevated"}
                className="h-full group hover:shadow-2xl hover:shadow-aletheia-gold/20 transition-all duration-300"
              >
                {/* Enhanced Header */}
                <div className="p-6 border-b border-aletheia-gold/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {draft.draft_type === 'grammar_fix' ? (
                        <div className="w-10 h-10 bg-gradient-to-br from-aletheia-info to-aletheia-info/70 rounded-xl flex items-center justify-center group-hover:animate-pulse">
                          <Target className="w-5 h-5 text-white" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-aletheia-success to-aletheia-success/70 rounded-xl flex items-center justify-center group-hover:animate-pulse">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-aletheia-text">
                          {draft.draft_type === 'grammar_fix' ? 'Grammar Fix' : 'Adaptive Polish'}
                        </h4>
                        <p className="text-xs text-aletheia-text-muted">
                          {draft.draft_type === 'grammar_fix' ? 'Precision Enhancement' : 'Style Adaptation'}
                        </p>
                      </div>
                    </div>

                    {draft.cpl_score > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1"
                      >
                        <Award className="w-4 h-4 text-aletheia-gold" />
                        <Badge className="bg-aletheia-gold/20 text-aletheia-gold border border-aletheia-gold/40 text-xs backdrop-blur-sm">
                          CPL {draft.cpl_score}
                        </Badge>
                      </motion.div>
                    )}
                  </div>

                  {/* Status Indicators */}
                  <div className="flex items-center gap-2">
                    {draft.is_accepted === true && (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="flex items-center gap-1"
                      >
                        <Badge className="bg-aletheia-success/20 text-aletheia-success border border-aletheia-success/40 backdrop-blur-sm">
                          <Check className="w-3 h-3 mr-1" />
                          Accepted
                        </Badge>
                      </motion.div>
                    )}
                    {draft.is_accepted === false && (
                      <motion.div
                        initial={{ scale: 0, rotate: 180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="flex items-center gap-1"
                      >
                        <Badge className="bg-aletheia-error/20 text-aletheia-error border border-aletheia-error/40 backdrop-blur-sm">
                          <X className="w-3 h-3 mr-1" />
                          Rejected
                        </Badge>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Enhanced Content */}
                <div className="p-6 space-y-4">
                  <AnimatePresence mode="wait">
                    {editingDraft === draft.id ? (
                      <motion.div
                        key="editing"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                      >
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="min-h-[120px] bg-aletheia-glass backdrop-blur-sm border border-aletheia-glass-border text-aletheia-text placeholder-aletheia-text-muted focus:border-aletheia-gold focus:ring-2 focus:ring-aletheia-gold/20 rounded-xl resize-none"
                          placeholder="Refine your content..."
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`relative p-4 bg-aletheia-glass/50 backdrop-blur-sm rounded-xl border transition-all duration-300 ${
                          isStreaming ? 'border-aletheia-gold/50 animate-pulse' : 'border-aletheia-glass-border'
                        }`}
                      >
                        <p className="text-aletheia-text whitespace-pre-wrap leading-relaxed">
                          {draft.content}
                          {isStreaming && draft.content && (
                            <motion.span
                              className="text-aletheia-gold"
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            >
                              |</motion.span>
                          )}
                        </p>
                        {isStreaming && !draft.content && (
                          <div className="flex items-center gap-3 text-aletheia-text-muted">
                            <div className="flex gap-1">
                              <motion.div
                                className="w-2 h-2 bg-aletheia-gold rounded-full"
                                animate={{ scale: [0.5, 1.2, 0.5] }}
                                transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                              />
                              <motion.div
                                className="w-2 h-2 bg-aletheia-gold rounded-full"
                                animate={{ scale: [0.5, 1.2, 0.5] }}
                                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                              />
                              <motion.div
                                className="w-2 h-2 bg-aletheia-gold rounded-full"
                                animate={{ scale: [0.5, 1.2, 0.5] }}
                                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                              />
                            </div>
                            <span className="text-sm">AI processing...</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Enhanced Action Buttons */}
                  <motion.div
                    className="flex items-center justify-between gap-3"
                    layout
                  >
                    <AnimatePresence mode="wait">
                      {editingDraft === draft.id ? (
                        <motion.div
                          key="edit-actions"
                          className="flex gap-2"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                        >
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button
                              onClick={saveEdits}
                              size="sm"
                              className="bg-gradient-to-r from-aletheia-success to-aletheia-success/80 hover:from-aletheia-success/80 hover:to-aletheia-success text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-aletheia-success/30"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Save Changes
                            </Button>
                          </motion.div>
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button
                              onClick={cancelEditing}
                              size="sm"
                              className="bg-aletheia-glass backdrop-blur-sm border border-aletheia-glass-border text-aletheia-text hover:bg-aletheia-glass/80 rounded-lg transition-all duration-300"
                            >
                              Cancel
                            </Button>
                          </motion.div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="main-actions"
                          className="flex gap-2"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                        >
                          {draft.is_accepted === null && (
                            <>
                              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button
                                  onClick={() => handleAccept(draft.id)}
                                  size="sm"
                                  className="bg-gradient-to-r from-aletheia-success to-aletheia-success/80 hover:from-aletheia-success/80 hover:to-aletheia-success text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-aletheia-success/30"
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Accept
                                </Button>
                              </motion.div>
                              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button
                                  onClick={() => startEditing(draft)}
                                  size="sm"
                                  className="bg-aletheia-glass backdrop-blur-sm border border-aletheia-gold/40 text-aletheia-gold hover:bg-aletheia-gold hover:text-aletheia-bg rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-aletheia-gold/30"
                                >
                                  <Edit3 className="w-4 h-4 mr-1" />
                                  Refine
                                </Button>
                              </motion.div>
                              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button
                                  onClick={() => handleReject(draft.id)}
                                  size="sm"
                                  className="bg-aletheia-glass backdrop-blur-sm border border-aletheia-error/40 text-aletheia-error hover:bg-aletheia-error hover:text-white rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-aletheia-error/30"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </motion.div>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={() => handleCopy(draft.content, draft.id)}
                        size="sm"
                        className="bg-aletheia-glass backdrop-blur-sm border border-aletheia-glass-border text-aletheia-text-muted hover:text-aletheia-text hover:bg-aletheia-glass/80 rounded-lg transition-all duration-300"
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        {copiedId === draft.id ? (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-aletheia-success"
                          >
                            Copied!
                          </motion.span>
                        ) : (
                          'Copy'
                        )}
                      </Button>
                    </motion.div>
                  </motion.div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}