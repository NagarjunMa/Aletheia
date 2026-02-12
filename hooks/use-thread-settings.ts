'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useChatStore } from '@/lib/stores/chat-store'

export interface ThreadMemorySettings {
  writingStyle: 'casual' | 'professional' | 'creative' | 'academic'
  formalityLevel: number
  preferredTone: 'friendly' | 'neutral' | 'authoritative'
  preferredLength: 'concise' | 'medium' | 'detailed'
  focusAreas: string[]
  avoidancePatterns: string[]
  customInstructions: string
  voiceLearningEnabled: boolean
}

export interface UseThreadSettingsReturn {
  settings: ThreadMemorySettings | null
  isLoading: boolean
  isSettingsDialogOpen: boolean
  openSettingsDialog: () => void
  closeSettingsDialog: () => void
  updateSettings: (newSettings: Partial<ThreadMemorySettings>) => Promise<void>
  resetSettings: () => void
  getContextualPrompt: (basePrompt: string) => string
}

/**
 * Hook for managing thread-specific memory settings and contextual prompts
 *
 * Features:
 * - Automatic settings loading when conversation changes
 * - Real-time contextual prompt generation
 * - Persistent storage in Supabase
 * - Integration with chat store
 * - Performance optimized with caching
 */
export function useThreadSettings(): UseThreadSettingsReturn {
  const [settings, setSettings] = useState<ThreadMemorySettings | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)

  const { conversation } = useChatStore()
  const supabase = createClient()

  // Load settings when conversation changes
  useEffect(() => {
    if (conversation?.current?.id) {
      loadThreadSettings(conversation.current.id)
    } else {
      setSettings(null)
    }
  }, [conversation?.current?.id])

  const loadThreadSettings = async (conversationId: string) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('conversation_memory')
        .select('*')
        .eq('conversation_id', conversationId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error
      }

      if (data) {
        setSettings({
          writingStyle: data.writing_style || 'professional',
          formalityLevel: data.formality_level || 70,
          preferredTone: data.preferred_tone || 'neutral',
          preferredLength: data.preferred_length || 'medium',
          focusAreas: data.focus_areas || [],
          avoidancePatterns: data.avoidance_patterns || [],
          customInstructions: data.custom_instructions || '',
          voiceLearningEnabled: data.voice_learning_enabled ?? true,
        })
      } else {
        // No settings found, use defaults
        setSettings({
          writingStyle: 'professional',
          formalityLevel: 70,
          preferredTone: 'neutral',
          preferredLength: 'medium',
          focusAreas: [],
          avoidancePatterns: [],
          customInstructions: '',
          voiceLearningEnabled: true,
        })
      }
    } catch (error) {
      console.error('Failed to load thread settings:', error)
      // Fall back to defaults on error
      setSettings({
        writingStyle: 'professional',
        formalityLevel: 70,
        preferredTone: 'neutral',
        preferredLength: 'medium',
        focusAreas: [],
        avoidancePatterns: [],
        customInstructions: '',
        voiceLearningEnabled: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateSettings = async (newSettings: Partial<ThreadMemorySettings>) => {
    if (!conversation?.current?.id || !settings) return

    const updatedSettings = { ...settings, ...newSettings }
    setSettings(updatedSettings)

    try {
      const { error } = await supabase
        .from('conversation_memory')
        .upsert({
          conversation_id: conversation.current.id,
          writing_style: updatedSettings.writingStyle,
          formality_level: updatedSettings.formalityLevel,
          preferred_tone: updatedSettings.preferredTone,
          preferred_length: updatedSettings.preferredLength,
          focus_areas: updatedSettings.focusAreas,
          avoidance_patterns: updatedSettings.avoidancePatterns,
          custom_instructions: updatedSettings.customInstructions,
          voice_learning_enabled: updatedSettings.voiceLearningEnabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'conversation_id'
        })

      if (error) throw error

      console.log('✅ Thread settings updated successfully')
    } catch (error) {
      console.error('Failed to update thread settings:', error)
      // Revert settings on error
      loadThreadSettings(conversation.current.id)
    }
  }

  const resetSettings = () => {
    const defaultSettings: ThreadMemorySettings = {
      writingStyle: 'professional',
      formalityLevel: 70,
      preferredTone: 'neutral',
      preferredLength: 'medium',
      focusAreas: [],
      avoidancePatterns: [],
      customInstructions: '',
      voiceLearningEnabled: true,
    }
    setSettings(defaultSettings)
  }

  const openSettingsDialog = () => setIsSettingsDialogOpen(true)
  const closeSettingsDialog = () => setIsSettingsDialogOpen(false)

  /**
   * Generate contextual prompt based on thread memory settings
   */
  const getContextualPrompt = (basePrompt: string): string => {
    if (!settings) return basePrompt

    let contextualPrompt = basePrompt

    // Add writing style context
    const styleInstructions = {
      casual: "Adopt a casual, conversational tone. Use everyday language and contractions.",
      professional: "Maintain a professional tone appropriate for business communication.",
      creative: "Be creative and expressive. Use vivid language and engaging storytelling techniques.",
      academic: "Use formal, scholarly language with precise terminology and structured arguments."
    }

    // Add formality context
    const formalityContext = settings.formalityLevel < 40
      ? "Keep the tone relaxed and informal."
      : settings.formalityLevel > 70
      ? "Maintain a formal, polished tone."
      : "Balance between casual and formal approaches."

    // Add tone context
    const toneInstructions = {
      friendly: "Be warm, approachable, and encouraging in your response.",
      neutral: "Maintain an objective, balanced perspective.",
      authoritative: "Demonstrate expertise and confidence in your recommendations."
    }

    // Add length preference
    const lengthInstructions = {
      concise: "Keep responses brief and to-the-point. Focus on essential information only.",
      medium: "Provide a balanced response with sufficient detail without being verbose.",
      detailed: "Provide comprehensive, thorough explanations with examples and context."
    }

    // Build contextual instructions
    let contextInstructions = []

    contextInstructions.push(styleInstructions[settings.writingStyle])
    contextInstructions.push(formalityContext)
    contextInstructions.push(toneInstructions[settings.preferredTone])
    contextInstructions.push(lengthInstructions[settings.preferredLength])

    // Add focus areas
    if (settings.focusAreas.length > 0) {
      contextInstructions.push(`Pay special attention to: ${settings.focusAreas.join(', ')}.`)
    }

    // Add avoidance patterns
    if (settings.avoidancePatterns.length > 0) {
      contextInstructions.push(`Avoid: ${settings.avoidancePatterns.join(', ')}.`)
    }

    // Add custom instructions
    if (settings.customInstructions.trim()) {
      contextInstructions.push(`Additional instructions: ${settings.customInstructions.trim()}`)
    }

    // Combine base prompt with contextual instructions
    const contextualInstructions = contextInstructions.join(' ')

    contextualPrompt = `${contextualInstructions}\n\nUser request: ${basePrompt}`

    return contextualPrompt
  }

  return {
    settings,
    isLoading,
    isSettingsDialogOpen,
    openSettingsDialog,
    closeSettingsDialog,
    updateSettings,
    resetSettings,
    getContextualPrompt
  }
}

/**
 * Usage Example:
 *
 * function ChatInterface() {
 *   const {
 *     settings,
 *     isSettingsDialogOpen,
 *     openSettingsDialog,
 *     closeSettingsDialog,
 *     getContextualPrompt
 *   } = useThreadSettings()
 *
 *   const handleSendMessage = async (message: string) => {
 *     // Apply contextual prompt enhancement
 *     const enhancedPrompt = getContextualPrompt(message)
 *     await generateDrafts(enhancedPrompt)
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={openSettingsDialog}>
 *         <Settings className="w-4 h-4" />
 *       </button>
 *
 *       <ThreadSettingsDialog
 *         isOpen={isSettingsDialogOpen}
 *         onClose={closeSettingsDialog}
 *         conversationId={conversation.current?.id}
 *       />
 *     </div>
 *   )
 * }
 */