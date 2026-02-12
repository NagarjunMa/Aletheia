'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  X,
  Brain,
  Clock,
  Target,
  Palette,
  BarChart3,
  Save,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react'
import { useChatStore } from '@/lib/stores/chat-store'
import { createClient } from '@/lib/supabase/client'
import { conversationMemoryEngine, getThreadMemory, updateThreadLearning } from '@/lib/memory/conversation-memory-engine'
import { threadSiloingSystem, createThreadSilo, switchThreadContext } from '@/lib/memory/thread-siloing-system'

interface ThreadSettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  conversationId: string
}

interface ConversationMemory {
  id: string
  contextualFactors: {
    writingStyle: 'casual' | 'professional' | 'creative' | 'academic'
    formality: number // 0-100
    tone: 'friendly' | 'neutral' | 'authoritative'
    preferredLength: 'concise' | 'medium' | 'detailed'
    complexity: number // 0-100
    domain: string
    audience: string
  }
  userPreferences: {
    focusAreas: string[]
    avoidancePatterns: string[]
    customInstructions: string
    voiceLearningEnabled: boolean
    memorySharing: boolean
    contextInheritance: boolean
    adaptivePersonalization: boolean
    privacyLevel: 'minimal' | 'standard' | 'enhanced' | 'maximum'
  }
  performanceMetrics: {
    averageCPLScore: number
    acceptanceRate: number
    totalDrafts: number
    adaptationSpeed: number
    contextualAccuracy: number
    memoryUtilization: number
    retrievalEfficiency: number
    learningProgress: number
    lastUpdated: Date
  }
}

/**
 * ThreadSettingsDialog - Advanced contextual memory management for conversations
 *
 * Features:
 * - Conversation-specific memory settings
 * - Voice learning pattern preferences
 * - Performance metrics visualization
 * - Real-time context adaptation
 * - Memory persistence across sessions
 */
export function ThreadSettingsDialog({ isOpen, onClose, conversationId }: ThreadSettingsDialogProps) {
  const [settings, setSettings] = useState<ConversationMemory | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'context' | 'preferences' | 'performance' | 'isolation' | 'insights'>('context')
  const [siloStatus, setSiloStatus] = useState<any>(null)
  const [memoryStats, setMemoryStats] = useState<any>(null)
  const [crossSiloInsights, setCrossSiloInsights] = useState<any>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const { conversation } = useChatStore()
  const supabase = createClient()

  // Load conversation memory on dialog open
  useEffect(() => {
    if (isOpen && conversationId) {
      loadConversationMemory()
      loadSiloStatus()
      loadMemoryStats()
    }
  }, [isOpen, conversationId])

  const loadConversationMemory = async () => {
    setIsLoading(true)
    try {
      // Get enhanced conversation memory from memory engine
      const memoryEngineData = await getThreadMemory(conversationId)

      // Get conversation details and memory
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_memory (*)
        `)
        .eq('id', conversationId)
        .single()

      if (convError) throw convError

      // Get performance metrics
      const { data: drafts } = await supabase
        .from('generated_drafts')
        .select('cpl_score, is_accepted, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })

      const acceptedDrafts = drafts?.filter(d => d.is_accepted) || []
      const avgCPL = drafts && drafts.length > 0
        ? drafts.reduce((sum, d) => sum + (d.cpl_score || 0), 0) / drafts.length
        : 0
      const acceptanceRate = drafts && drafts.length > 0
        ? (acceptedDrafts.length / drafts.length) * 100
        : 0

      // Build enhanced memory object with memory engine integration
      const memory: ConversationMemory = {
        id: conversationId,
        contextualFactors: {
          writingStyle: memoryEngineData?.contextualFactors.writingStyle || conv.conversation_memory?.writing_style || 'professional',
          formality: memoryEngineData?.contextualFactors.formality || conv.conversation_memory?.formality_level || 70,
          tone: memoryEngineData?.contextualFactors.tone || conv.conversation_memory?.preferred_tone || 'neutral',
          preferredLength: memoryEngineData?.contextualFactors.preferredLength || conv.conversation_memory?.preferred_length || 'medium',
          complexity: memoryEngineData?.contextualFactors.complexity || 60,
          domain: memoryEngineData?.contextualFactors.domain || 'general',
          audience: memoryEngineData?.contextualFactors.audience || 'external'
        },
        userPreferences: {
          focusAreas: memoryEngineData?.userPreferences.focusAreas || conv.conversation_memory?.focus_areas || [],
          avoidancePatterns: memoryEngineData?.userPreferences.avoidancePatterns || conv.conversation_memory?.avoidance_patterns || [],
          customInstructions: memoryEngineData?.userPreferences.customInstructions || conv.conversation_memory?.custom_instructions || '',
          voiceLearningEnabled: memoryEngineData?.userPreferences.voiceLearningEnabled ?? conv.conversation_memory?.voice_learning_enabled ?? true,
          memorySharing: memoryEngineData?.userPreferences.memorySharing ?? false,
          contextInheritance: memoryEngineData?.userPreferences.contextInheritance ?? true,
          adaptivePersonalization: memoryEngineData?.userPreferences.adaptivePersonalization ?? true,
          privacyLevel: memoryEngineData?.userPreferences.privacyLevel || 'standard'
        },
        performanceMetrics: {
          averageCPLScore: memoryEngineData?.performanceMetrics.averageCPLScore || Math.round(avgCPL),
          acceptanceRate: memoryEngineData?.performanceMetrics.acceptanceRate || Math.round(acceptanceRate),
          totalDrafts: drafts?.length || 0,
          adaptationSpeed: memoryEngineData?.performanceMetrics.adaptationSpeed || 0.7,
          contextualAccuracy: memoryEngineData?.performanceMetrics.contextualAccuracy || 85,
          memoryUtilization: memoryEngineData?.performanceMetrics.memoryUtilization || 0.6,
          retrievalEfficiency: memoryEngineData?.performanceMetrics.retrievalEfficiency || 0.9,
          learningProgress: memoryEngineData?.performanceMetrics.learningProgress || 0,
          lastUpdated: conv.conversation_memory?.updated_at
            ? new Date(conv.conversation_memory.updated_at)
            : new Date()
        }
      }

      setSettings(memory)
    } catch (error) {
      console.error('Failed to load conversation memory:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveMemorySettings = async () => {
    if (!settings) return

    setIsSaving(true)
    try {
      // Save to traditional database
      const { error } = await supabase
        .from('conversation_memory')
        .upsert({
          conversation_id: conversationId,
          writing_style: settings.contextualFactors.writingStyle,
          formality_level: settings.contextualFactors.formality,
          preferred_tone: settings.contextualFactors.tone,
          preferred_length: settings.contextualFactors.preferredLength,
          complexity_level: settings.contextualFactors.complexity || 60,
          domain_context: settings.contextualFactors.domain || 'general',
          target_audience: settings.contextualFactors.audience || 'external',
          focus_areas: settings.userPreferences.focusAreas,
          avoidance_patterns: settings.userPreferences.avoidancePatterns,
          custom_instructions: settings.userPreferences.customInstructions,
          voice_learning_enabled: settings.userPreferences.voiceLearningEnabled,
          memory_sharing_enabled: settings.userPreferences.memorySharing || false,
          context_inheritance_enabled: settings.userPreferences.contextInheritance ?? true,
          adaptive_personalization_enabled: settings.userPreferences.adaptivePersonalization ?? true,
          privacy_level: settings.userPreferences.privacyLevel || 'standard',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'conversation_id'
        })

      if (error) throw error

      // Initialize or update memory engine
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await conversationMemoryEngine.initializeConversationMemory(conversationId, user.id)
      }

      console.log('✅ Enhanced conversation memory updated successfully')
      onClose()
    } catch (error) {
      console.error('Failed to save memory settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const resetToDefault = () => {
    if (!settings) return

    setSettings({
      ...settings,
      contextualFactors: {
        writingStyle: 'professional',
        formality: 70,
        tone: 'neutral',
        preferredLength: 'medium',
        complexity: 60,
        domain: 'general',
        audience: 'external'
      },
      userPreferences: {
        focusAreas: [],
        avoidancePatterns: [],
        customInstructions: '',
        voiceLearningEnabled: true,
        memorySharing: false,
        contextInheritance: true,
        adaptivePersonalization: true,
        privacyLevel: 'standard'
      }
    })
  }

  // Load silo status and statistics
  const loadSiloStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get current silo information
      const userSilos = threadSiloingSystem.getUserSilos(user.id)
      const currentSilo = threadSiloingSystem.getCurrentSilo()
      const stats = threadSiloingSystem.getStats()

      setSiloStatus({
        userSilos: userSilos.length,
        currentSilo,
        totalSilos: stats.activeSilos,
        avgPerformance: stats.avgPerformance,
        isolationLevel: threadSiloingSystem.config?.isolationLevel || 'enhanced'
      })
    } catch (error) {
      console.error('Failed to load silo status:', error)
    }
  }

  const loadMemoryStats = async () => {
    try {
      const stats = conversationMemoryEngine.getStats()
      setMemoryStats(stats)
    } catch (error) {
      console.error('Failed to load memory stats:', error)
    }
  }

  const loadCrossSiloInsights = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const insights = await threadSiloingSystem.getCrossSiloInsights(
        user.id,
        'writing style preferences',
        5
      )
      setCrossSiloInsights(insights)
    } catch (error) {
      console.error('Failed to load cross-silo insights:', error)
    }
  }

  const createNewSilo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const silo = await createThreadSilo(conversationId, user.id)
      const switchResult = await switchThreadContext(silo.siloId, user.id, 'user_created')

      if (switchResult.success) {
        loadSiloStatus()
        console.log('✅ New silo created and activated:', silo.siloId)
      }
    } catch (error) {
      console.error('Failed to create new silo:', error)
    }
  }

  if (!settings && !isLoading) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            className="relative w-full max-w-4xl mx-4 bg-aletheia-dark border border-aletheia-glass-border rounded-xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-aletheia-glass-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-aletheia-accent/20 rounded-lg">
                  <Brain className="w-5 h-5 text-aletheia-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-aletheia-text">Thread Memory Settings</h2>
                  <p className="text-sm text-aletheia-text-muted">
                    Customize contextual memory for this conversation
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-aletheia-glass/50 transition-colors"
              >
                <X className="w-5 h-5 text-aletheia-text-muted" />
              </button>
            </div>

            {/* Content */}
            <div className="flex">
              {/* Sidebar Navigation */}
              <div className="w-64 p-6 border-r border-aletheia-glass-border">
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab('context')}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      activeTab === 'context'
                        ? 'bg-aletheia-accent/20 text-aletheia-accent'
                        : 'text-aletheia-text-muted hover:bg-aletheia-glass/50'
                    }`}
                  >
                    <Target className="w-4 h-4" />
                    Context Settings
                  </button>
                  <button
                    onClick={() => setActiveTab('preferences')}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      activeTab === 'preferences'
                        ? 'bg-aletheia-accent/20 text-aletheia-accent'
                        : 'text-aletheia-text-muted hover:bg-aletheia-glass/50'
                    }`}
                  >
                    <Palette className="w-4 h-4" />
                    Preferences
                  </button>
                  <button
                    onClick={() => setActiveTab('performance')}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      activeTab === 'performance'
                        ? 'bg-aletheia-accent/20 text-aletheia-accent'
                        : 'text-aletheia-text-muted hover:bg-aletheia-glass/50'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Performance
                  </button>

                  {/* Advanced Tabs */}
                  {showAdvanced && (
                    <>
                      <button
                        onClick={() => {
                          setActiveTab('isolation')
                          loadSiloStatus()
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          activeTab === 'isolation'
                            ? 'bg-aletheia-accent/20 text-aletheia-accent'
                            : 'text-aletheia-text-muted hover:bg-aletheia-glass/50'
                        }`}
                      >
                        <Settings className="w-4 h-4" />
                        Isolation Controls
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('insights')
                          loadCrossSiloInsights()
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          activeTab === 'insights'
                            ? 'bg-aletheia-accent/20 text-aletheia-accent'
                            : 'text-aletheia-text-muted hover:bg-aletheia-glass/50'
                        }`}
                      >
                        <Brain className="w-4 h-4" />
                        Cross-Silo Insights
                      </button>
                    </>
                  )}
                </div>

                {/* Advanced Toggle */}
                <div className="mt-6 pt-6 border-t border-aletheia-glass-border">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-sm text-aletheia-text-muted hover:bg-aletheia-glass/50 transition-colors"
                  >
                    {showAdvanced ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                  </button>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 p-6">
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="flex items-center gap-3 text-aletheia-text-muted">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Loading conversation memory...
                    </div>
                  </div>
                ) : settings ? (
                  <div className="space-y-6">
                    {/* Context Settings Tab */}
                    {activeTab === 'context' && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                      >
                        <div>
                          <h3 className="text-lg font-medium text-aletheia-text mb-4">Contextual Factors</h3>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Writing Style */}
                            <div>
                              <label className="block text-sm font-medium text-aletheia-text mb-2">
                                Writing Style
                              </label>
                              <select
                                value={settings.contextualFactors.writingStyle}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  contextualFactors: {
                                    ...settings.contextualFactors,
                                    writingStyle: e.target.value as any
                                  }
                                })}
                                className="w-full p-3 bg-aletheia-glass/50 border border-aletheia-glass-border rounded-lg text-aletheia-text focus:outline-none focus:border-aletheia-accent"
                              >
                                <option value="casual">Casual</option>
                                <option value="professional">Professional</option>
                                <option value="creative">Creative</option>
                                <option value="academic">Academic</option>
                              </select>
                            </div>

                            {/* Tone */}
                            <div>
                              <label className="block text-sm font-medium text-aletheia-text mb-2">
                                Preferred Tone
                              </label>
                              <select
                                value={settings.contextualFactors.tone}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  contextualFactors: {
                                    ...settings.contextualFactors,
                                    tone: e.target.value as any
                                  }
                                })}
                                className="w-full p-3 bg-aletheia-glass/50 border border-aletheia-glass-border rounded-lg text-aletheia-text focus:outline-none focus:border-aletheia-accent"
                              >
                                <option value="friendly">Friendly</option>
                                <option value="neutral">Neutral</option>
                                <option value="authoritative">Authoritative</option>
                              </select>
                            </div>

                            {/* Formality Slider */}
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-aletheia-text mb-2">
                                Formality Level: {settings.contextualFactors.formality}%
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={settings.contextualFactors.formality}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  contextualFactors: {
                                    ...settings.contextualFactors,
                                    formality: parseInt(e.target.value)
                                  }
                                })}
                                className="w-full h-2 bg-aletheia-glass rounded-lg appearance-none cursor-pointer slider"
                              />
                              <div className="flex justify-between text-xs text-aletheia-text-muted mt-1">
                                <span>Casual</span>
                                <span>Balanced</span>
                                <span>Formal</span>
                              </div>
                            </div>

                            {/* Preferred Length */}
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-aletheia-text mb-2">
                                Response Length
                              </label>
                              <div className="flex gap-3">
                                {['concise', 'medium', 'detailed'].map((length) => (
                                  <button
                                    key={length}
                                    onClick={() => setSettings({
                                      ...settings,
                                      contextualFactors: {
                                        ...settings.contextualFactors,
                                        preferredLength: length as any
                                      }
                                    })}
                                    className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                                      settings.contextualFactors.preferredLength === length
                                        ? 'bg-aletheia-accent text-white'
                                        : 'bg-aletheia-glass/50 text-aletheia-text-muted hover:bg-aletheia-glass'
                                    }`}
                                  >
                                    {length}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Preferences Tab */}
                    {activeTab === 'preferences' && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                      >
                        <div>
                          <h3 className="text-lg font-medium text-aletheia-text mb-4">User Preferences</h3>

                          <div className="space-y-6">
                            {/* Voice Learning Toggle */}
                            <div className="flex items-center justify-between p-4 bg-aletheia-glass/30 rounded-lg border border-aletheia-glass-border">
                              <div>
                                <label className="text-sm font-medium text-aletheia-text">Voice Learning</label>
                                <p className="text-xs text-aletheia-text-muted mt-1">
                                  Enable AI to learn and adapt to your writing style
                                </p>
                              </div>
                              <button
                                onClick={() => setSettings({
                                  ...settings!,
                                  userPreferences: {
                                    ...settings!.userPreferences,
                                    voiceLearningEnabled: !settings!.userPreferences.voiceLearningEnabled
                                  }
                                })}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-aletheia-accent focus:ring-offset-2 ${
                                  settings?.userPreferences.voiceLearningEnabled ? 'bg-aletheia-accent' : 'bg-gray-200'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                                    settings?.userPreferences.voiceLearningEnabled ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>

                            {/* Focus Areas */}
                            <div>
                              <label className="block text-sm font-medium text-aletheia-text mb-2">
                                Focus Areas
                              </label>
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={settings?.userPreferences.focusAreas.join(', ') || ''}
                                  onChange={(e) => setSettings({
                                    ...settings!,
                                    userPreferences: {
                                      ...settings!.userPreferences,
                                      focusAreas: e.target.value.split(',').map(area => area.trim()).filter(Boolean)
                                    }
                                  })}
                                  placeholder="e.g., grammar, clarity, conciseness"
                                  className="w-full p-3 bg-aletheia-glass/50 border border-aletheia-glass-border rounded-lg text-aletheia-text focus:outline-none focus:border-aletheia-accent"
                                />
                                <p className="text-xs text-aletheia-text-muted">
                                  Comma-separated list of areas to focus on when improving text
                                </p>
                              </div>
                            </div>

                            {/* Avoidance Patterns */}
                            <div>
                              <label className="block text-sm font-medium text-aletheia-text mb-2">
                                Avoidance Patterns
                              </label>
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={settings?.userPreferences.avoidancePatterns.join(', ') || ''}
                                  onChange={(e) => setSettings({
                                    ...settings!,
                                    userPreferences: {
                                      ...settings!.userPreferences,
                                      avoidancePatterns: e.target.value.split(',').map(pattern => pattern.trim()).filter(Boolean)
                                    }
                                  })}
                                  placeholder="e.g., overly formal language, jargon"
                                  className="w-full p-3 bg-aletheia-glass/50 border border-aletheia-glass-border rounded-lg text-aletheia-text focus:outline-none focus:border-aletheia-accent"
                                />
                                <p className="text-xs text-aletheia-text-muted">
                                  Patterns or styles to avoid in generated content
                                </p>
                              </div>
                            </div>

                            {/* Custom Instructions */}
                            <div>
                              <label className="block text-sm font-medium text-aletheia-text mb-2">
                                Custom Instructions
                              </label>
                              <div className="space-y-2">
                                <textarea
                                  value={settings?.userPreferences.customInstructions || ''}
                                  onChange={(e) => setSettings({
                                    ...settings!,
                                    userPreferences: {
                                      ...settings!.userPreferences,
                                      customInstructions: e.target.value
                                    }
                                  })}
                                  placeholder="Any specific instructions for how you want content to be processed..."
                                  rows={4}
                                  className="w-full p-3 bg-aletheia-glass/50 border border-aletheia-glass-border rounded-lg text-aletheia-text focus:outline-none focus:border-aletheia-accent resize-none"
                                />
                                <p className="text-xs text-aletheia-text-muted">
                                  Specific instructions that will be applied to all content processing
                                </p>
                              </div>
                            </div>

                            {/* Advanced Memory Preferences */}
                            {showAdvanced && (
                              <div className="space-y-4 pt-4 border-t border-aletheia-glass-border">
                                <h4 className="text-md font-medium text-aletheia-text">Advanced Memory Settings</h4>

                                {/* Memory Sharing */}
                                <div className="flex items-center justify-between p-4 bg-aletheia-glass/30 rounded-lg border border-aletheia-glass-border">
                                  <div>
                                    <label className="text-sm font-medium text-aletheia-text">Cross-Thread Memory Sharing</label>
                                    <p className="text-xs text-aletheia-text-muted mt-1">
                                      Allow insights from other conversations to inform this thread
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => setSettings({
                                      ...settings!,
                                      userPreferences: {
                                        ...settings!.userPreferences,
                                        memorySharing: !settings!.userPreferences.memorySharing
                                      }
                                    })}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-aletheia-accent focus:ring-offset-2 ${
                                      settings?.userPreferences.memorySharing ? 'bg-aletheia-accent' : 'bg-gray-200'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                                        settings?.userPreferences.memorySharing ? 'translate-x-5' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </div>

                                {/* Context Inheritance */}
                                <div className="flex items-center justify-between p-4 bg-aletheia-glass/30 rounded-lg border border-aletheia-glass-border">
                                  <div>
                                    <label className="text-sm font-medium text-aletheia-text">Context Inheritance</label>
                                    <p className="text-xs text-aletheia-text-muted mt-1">
                                      Inherit context and patterns from parent conversations
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => setSettings({
                                      ...settings!,
                                      userPreferences: {
                                        ...settings!.userPreferences,
                                        contextInheritance: !settings!.userPreferences.contextInheritance
                                      }
                                    })}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-aletheia-accent focus:ring-offset-2 ${
                                      settings?.userPreferences.contextInheritance ? 'bg-aletheia-accent' : 'bg-gray-200'
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                                        settings?.userPreferences.contextInheritance ? 'translate-x-5' : 'translate-x-0'
                                      }`}
                                    />
                                  </button>
                                </div>

                                {/* Privacy Level */}
                                <div>
                                  <label className="block text-sm font-medium text-aletheia-text mb-2">
                                    Privacy Level
                                  </label>
                                  <select
                                    value={settings?.userPreferences.privacyLevel || 'standard'}
                                    onChange={(e) => setSettings({
                                      ...settings!,
                                      userPreferences: {
                                        ...settings!.userPreferences,
                                        privacyLevel: e.target.value as 'minimal' | 'standard' | 'enhanced' | 'maximum'
                                      }
                                    })}
                                    className="w-full p-3 bg-aletheia-glass/50 border border-aletheia-glass-border rounded-lg text-aletheia-text focus:outline-none focus:border-aletheia-accent"
                                  >
                                    <option value="minimal">Minimal - Basic functionality only</option>
                                    <option value="standard">Standard - Balanced privacy and features</option>
                                    <option value="enhanced">Enhanced - Extra privacy protections</option>
                                    <option value="maximum">Maximum - Full privacy mode</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Performance Tab */}
                    {activeTab === 'performance' && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                      >
                        <div>
                          <h3 className="text-lg font-medium text-aletheia-text mb-4">Performance Metrics</h3>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-4 bg-aletheia-glass/30 rounded-lg border border-aletheia-glass-border">
                              <div className="flex items-center gap-3 mb-2">
                                <Target className="w-5 h-5 text-aletheia-accent" />
                                <span className="text-sm font-medium text-aletheia-text">Average CPL</span>
                              </div>
                              <div className="text-2xl font-bold text-aletheia-accent">
                                {settings.performanceMetrics.averageCPLScore}
                              </div>
                              <div className="text-xs text-aletheia-text-muted">Content Quality Score</div>
                            </div>

                            <div className="p-4 bg-aletheia-glass/30 rounded-lg border border-aletheia-glass-border">
                              <div className="flex items-center gap-3 mb-2">
                                <BarChart3 className="w-5 h-5 text-aletheia-success" />
                                <span className="text-sm font-medium text-aletheia-text">Acceptance Rate</span>
                              </div>
                              <div className="text-2xl font-bold text-aletheia-success">
                                {settings.performanceMetrics.acceptanceRate}%
                              </div>
                              <div className="text-xs text-aletheia-text-muted">Drafts Approved</div>
                            </div>

                            <div className="p-4 bg-aletheia-glass/30 rounded-lg border border-aletheia-glass-border">
                              <div className="flex items-center gap-3 mb-2">
                                <Clock className="w-5 h-5 text-aletheia-gold" />
                                <span className="text-sm font-medium text-aletheia-text">Total Drafts</span>
                              </div>
                              <div className="text-2xl font-bold text-aletheia-gold">
                                {settings.performanceMetrics.totalDrafts}
                              </div>
                              <div className="text-xs text-aletheia-text-muted">Generated Content</div>
                            </div>
                          </div>

                          <div className="mt-6 p-4 bg-aletheia-glass/20 rounded-lg border border-aletheia-glass-border">
                            <div className="flex items-center gap-2 text-sm text-aletheia-text-muted">
                              <Clock className="w-4 h-4" />
                              Last updated: {settings.performanceMetrics.lastUpdated.toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Isolation Controls Tab */}
                    {activeTab === 'isolation' && showAdvanced && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                      >
                        <div>
                          <h3 className="text-lg font-medium text-aletheia-text mb-4">Thread Isolation Controls</h3>

                          {/* Current Silo Status */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-4 bg-aletheia-glass/30 rounded-lg border border-aletheia-glass-border">
                              <div className="flex items-center gap-3 mb-2">
                                <Settings className="w-5 h-5 text-aletheia-accent" />
                                <span className="text-sm font-medium text-aletheia-text">Current Silo</span>
                              </div>
                              <div className="text-lg font-bold text-aletheia-accent">
                                {siloStatus?.currentSilo?.siloId || 'Default'}
                              </div>
                              <div className="text-xs text-aletheia-text-muted">
                                Isolation Level: {siloStatus?.isolationLevel || 'Enhanced'}
                              </div>
                            </div>

                            <div className="p-4 bg-aletheia-glass/30 rounded-lg border border-aletheia-glass-border">
                              <div className="flex items-center gap-3 mb-2">
                                <Brain className="w-5 h-5 text-aletheia-gold" />
                                <span className="text-sm font-medium text-aletheia-text">Total Silos</span>
                              </div>
                              <div className="text-lg font-bold text-aletheia-gold">
                                {siloStatus?.totalSilos || 0}
                              </div>
                              <div className="text-xs text-aletheia-text-muted">
                                User Silos: {siloStatus?.userSilos || 0}
                              </div>
                            </div>
                          </div>

                          {/* Silo Management */}
                          <div className="space-y-4">
                            <h4 className="text-md font-medium text-aletheia-text">Silo Management</h4>

                            <div className="flex flex-col sm:flex-row gap-4">
                              <button
                                onClick={createNewSilo}
                                className="flex items-center gap-2 px-4 py-2 bg-aletheia-accent text-white rounded-lg hover:bg-aletheia-accent/90 transition-colors"
                              >
                                <Brain className="w-4 h-4" />
                                Create New Silo
                              </button>

                              <button
                                onClick={loadSiloStatus}
                                className="flex items-center gap-2 px-4 py-2 bg-aletheia-glass/50 text-aletheia-text border border-aletheia-glass-border rounded-lg hover:bg-aletheia-glass transition-colors"
                              >
                                <RefreshCw className="w-4 h-4" />
                                Refresh Status
                              </button>
                            </div>

                            {/* Silo Performance */}
                            {siloStatus?.avgPerformance !== undefined && (
                              <div className="p-4 bg-aletheia-glass/20 rounded-lg border border-aletheia-glass-border">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-aletheia-text">Average Silo Performance</span>
                                  <span className="text-sm text-aletheia-accent">{(siloStatus.avgPerformance * 100).toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                  <div
                                    className="bg-aletheia-accent rounded-full h-2 transition-all duration-300"
                                    style={{ width: `${siloStatus.avgPerformance * 100}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Memory Stats */}
                            {memoryStats && (
                              <div className="p-4 bg-aletheia-glass/20 rounded-lg border border-aletheia-glass-border">
                                <h5 className="text-sm font-medium text-aletheia-text mb-3">Memory Engine Statistics</h5>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <span className="text-aletheia-text-muted">Active Threads:</span>
                                    <span className="ml-2 text-aletheia-text">{memoryStats.activeThreads || 0}</span>
                                  </div>
                                  <div>
                                    <span className="text-aletheia-text-muted">Memory Usage:</span>
                                    <span className="ml-2 text-aletheia-text">{memoryStats.memoryUsage || '0MB'}</span>
                                  </div>
                                  <div>
                                    <span className="text-aletheia-text-muted">Cache Hits:</span>
                                    <span className="ml-2 text-aletheia-text">{memoryStats.cacheHitRate || '0%'}</span>
                                  </div>
                                  <div>
                                    <span className="text-aletheia-text-muted">Retrieval Speed:</span>
                                    <span className="ml-2 text-aletheia-text">{memoryStats.retrievalSpeed || '0ms'}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Cross-Silo Insights Tab */}
                    {activeTab === 'insights' && showAdvanced && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                      >
                        <div>
                          <h3 className="text-lg font-medium text-aletheia-text mb-4">Cross-Silo Insights</h3>

                          {/* Insights Summary */}
                          {crossSiloInsights && crossSiloInsights.length > 0 ? (
                            <div className="space-y-4">
                              <div className="p-4 bg-aletheia-glass/30 rounded-lg border border-aletheia-glass-border">
                                <h4 className="text-md font-medium text-aletheia-text mb-3">
                                  🧠 Writing Style Patterns Across Conversations
                                </h4>
                                <div className="space-y-3">
                                  {crossSiloInsights.map((insight: any, index: number) => (
                                    <div key={index} className="p-3 bg-aletheia-glass/20 rounded-lg">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-aletheia-text">
                                          {insight.pattern || 'Style Pattern'}
                                        </span>
                                        <span className="text-xs text-aletheia-accent">
                                          Confidence: {insight.confidence || 85}%
                                        </span>
                                      </div>
                                      <p className="text-xs text-aletheia-text-muted">
                                        {insight.description || 'Pattern analysis across conversation contexts'}
                                      </p>
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs text-aletheia-text-muted">
                                          Found in {insight.occurrences || 3} conversations
                                        </span>
                                        <span className="text-xs text-aletheia-gold">
                                          Impact: {insight.impact || 'Medium'}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Pattern Recommendations */}
                              <div className="p-4 bg-aletheia-glass/30 rounded-lg border border-aletheia-glass-border">
                                <h4 className="text-md font-medium text-aletheia-text mb-3">
                                  ✨ Personalization Recommendations
                                </h4>
                                <div className="space-y-2">
                                  <div className="p-3 bg-aletheia-glass/20 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Target className="w-4 h-4 text-aletheia-accent" />
                                      <span className="text-sm text-aletheia-text">Consistent Formality Preference</span>
                                    </div>
                                    <p className="text-xs text-aletheia-text-muted">
                                      Your writing tends toward {settings?.contextualFactors.formality || 70}% formality across contexts
                                    </p>
                                  </div>
                                  <div className="p-3 bg-aletheia-glass/20 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Palette className="w-4 h-4 text-aletheia-gold" />
                                      <span className="text-sm text-aletheia-text">Voice Consistency</span>
                                    </div>
                                    <p className="text-xs text-aletheia-text-muted">
                                      Strong consistency detected in {settings?.contextualFactors.writingStyle} style across conversations
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <Brain className="w-12 h-12 text-aletheia-text-muted mx-auto mb-4" />
                              <h4 className="text-lg font-medium text-aletheia-text mb-2">No Cross-Silo Insights Yet</h4>
                              <p className="text-sm text-aletheia-text-muted">
                                Cross-silo insights will appear as you use the AI assistant across multiple conversation contexts.
                              </p>
                              <button
                                onClick={loadCrossSiloInsights}
                                className="mt-4 px-4 py-2 bg-aletheia-accent text-white rounded-lg hover:bg-aletheia-accent/90 transition-colors"
                              >
                                Analyze Patterns
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-aletheia-glass-border">
              <button
                onClick={resetToDefault}
                className="flex items-center gap-2 px-4 py-2 text-sm text-aletheia-text-muted hover:text-aletheia-text transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reset to Default
              </button>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 text-aletheia-text-muted hover:text-aletheia-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveMemorySettings}
                  disabled={isSaving || isLoading}
                  className="flex items-center gap-2 px-6 py-2 bg-aletheia-accent text-white rounded-lg hover:bg-aletheia-accent/90 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/**
 * Usage Example:
 *
 * <ThreadSettingsDialog
 *   isOpen={showThreadSettings}
 *   onClose={() => setShowThreadSettings(false)}
 *   conversationId={conversation.id}
 * />
 *
 * Features:
 * - Conversation-specific memory persistence
 * - Real-time performance metrics
 * - Advanced contextual adaptation
 * - Voice learning preferences
 * - Visual feedback and analytics
 */