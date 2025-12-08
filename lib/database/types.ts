// Ascendia Database Types
// Generated from schema.sql - December 7, 2024
// Auto-generated types for type-safe database operations

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
          last_activity_at: string
          cpl_score: number
          writing_style_data: Json
          learning_preferences: Json
          subscription_status: 'free' | 'premium' | 'enterprise'
          monthly_api_usage: number
          monthly_limit: number
          preferences: Json
          data_retention_days: number
          analytics_enabled: boolean
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
          last_activity_at?: string
          cpl_score?: number
          writing_style_data?: Json
          learning_preferences?: Json
          subscription_status?: 'free' | 'premium' | 'enterprise'
          monthly_api_usage?: number
          monthly_limit?: number
          preferences?: Json
          data_retention_days?: number
          analytics_enabled?: boolean
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
          last_activity_at?: string
          cpl_score?: number
          writing_style_data?: Json
          learning_preferences?: Json
          subscription_status?: 'free' | 'premium' | 'enterprise'
          monthly_api_usage?: number
          monthly_limit?: number
          preferences?: Json
          data_retention_days?: number
          analytics_enabled?: boolean
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          category: 'email' | 'letter' | 'proposal' | 'memo' | 'general' | 'creative' | 'technical'
          is_archived: boolean
          is_pinned: boolean
          created_at: string
          updated_at: string
          last_activity_at: string
          context: Json
          tags: string[]
          total_drafts_generated: number
          average_cpl_score: number | null
          total_time_spent_minutes: number
          word_count: number
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          category?: 'email' | 'letter' | 'proposal' | 'memo' | 'general' | 'creative' | 'technical'
          is_archived?: boolean
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
          last_activity_at?: string
          context?: Json
          tags?: string[]
          total_drafts_generated?: number
          average_cpl_score?: number | null
          total_time_spent_minutes?: number
          word_count?: number
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          category?: 'email' | 'letter' | 'proposal' | 'memo' | 'general' | 'creative' | 'technical'
          is_archived?: boolean
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
          last_activity_at?: string
          context?: Json
          tags?: string[]
          total_drafts_generated?: number
          average_cpl_score?: number | null
          total_time_spent_minutes?: number
          word_count?: number
        }
      }
      user_inputs: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          raw_text: string
          cleaned_text: string | null
          input_type: 'text' | 'voice' | 'document' | 'paste'
          word_count: number
          character_count: number
          language_detected: string
          complexity_score: number | null
          readability_score: number | null
          created_at: string
          content_analysis: Json
          sensitive_content_detected: boolean
          auto_delete_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          raw_text: string
          cleaned_text?: string | null
          input_type?: 'text' | 'voice' | 'document' | 'paste'
          language_detected?: string
          complexity_score?: number | null
          readability_score?: number | null
          created_at?: string
          content_analysis?: Json
          sensitive_content_detected?: boolean
          auto_delete_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string
          raw_text?: string
          cleaned_text?: string | null
          input_type?: 'text' | 'voice' | 'document' | 'paste'
          language_detected?: string
          complexity_score?: number | null
          readability_score?: number | null
          created_at?: string
          content_analysis?: Json
          sensitive_content_detected?: boolean
          auto_delete_at?: string | null
        }
      }
      generated_drafts: {
        Row: {
          id: string
          user_input_id: string
          conversation_id: string
          user_id: string
          content: string
          original_content: string | null
          draft_type: 'grammar_fix' | 'adaptive_polish' | 'creative_enhancement' | 'tone_adjustment'
          version: number
          cpl_score: number | null
          target_cpl_score: number | null
          processing_time_ms: number | null
          token_usage: number | null
          is_accepted: boolean | null
          user_rating: number | null
          feedback_text: string | null
          user_edits: string | null
          created_at: string
          updated_at: string
          reviewed_at: string | null
          ai_model_used: string
          ai_model_version: string | null
          processing_metadata: Json
          improvement_metrics: Json
          quality_score: number | null
          word_count: number
          character_count: number
        }
        Insert: {
          id?: string
          user_input_id: string
          conversation_id: string
          user_id: string
          content: string
          original_content?: string | null
          draft_type: 'grammar_fix' | 'adaptive_polish' | 'creative_enhancement' | 'tone_adjustment'
          version?: number
          cpl_score?: number | null
          target_cpl_score?: number | null
          processing_time_ms?: number | null
          token_usage?: number | null
          is_accepted?: boolean | null
          user_rating?: number | null
          feedback_text?: string | null
          user_edits?: string | null
          created_at?: string
          updated_at?: string
          reviewed_at?: string | null
          ai_model_used?: string
          ai_model_version?: string | null
          processing_metadata?: Json
          improvement_metrics?: Json
          quality_score?: number | null
        }
        Update: {
          id?: string
          user_input_id?: string
          conversation_id?: string
          user_id?: string
          content?: string
          original_content?: string | null
          draft_type?: 'grammar_fix' | 'adaptive_polish' | 'creative_enhancement' | 'tone_adjustment'
          version?: number
          cpl_score?: number | null
          target_cpl_score?: number | null
          processing_time_ms?: number | null
          token_usage?: number | null
          is_accepted?: boolean | null
          user_rating?: number | null
          feedback_text?: string | null
          user_edits?: string | null
          created_at?: string
          updated_at?: string
          reviewed_at?: string | null
          ai_model_used?: string
          ai_model_version?: string | null
          processing_metadata?: Json
          improvement_metrics?: Json
          quality_score?: number | null
        }
      }
      api_usage_logs: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          method: string
          status_code: number | null
          tokens_used: number
          cost_cents: number
          response_time_ms: number | null
          request_size_bytes: number | null
          response_size_bytes: number | null
          user_agent: string | null
          ip_address: string | null
          created_at: string
          metadata: Json
          error_details: string | null
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          method: string
          status_code?: number | null
          tokens_used?: number
          cost_cents?: number
          response_time_ms?: number | null
          request_size_bytes?: number | null
          response_size_bytes?: number | null
          user_agent?: string | null
          ip_address?: string | null
          created_at?: string
          metadata?: Json
          error_details?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          method?: string
          status_code?: number | null
          tokens_used?: number
          cost_cents?: number
          response_time_ms?: number | null
          request_size_bytes?: number | null
          response_size_bytes?: number | null
          user_agent?: string | null
          ip_address?: string | null
          created_at?: string
          metadata?: Json
          error_details?: string | null
        }
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string
          session_token: string
          device_info: Json
          ip_address: string | null
          user_agent: string | null
          location_data: Json | null
          is_active: boolean
          last_activity_at: string
          created_at: string
          expires_at: string
          security_flags: Json
        }
        Insert: {
          id?: string
          user_id: string
          session_token: string
          device_info?: Json
          ip_address?: string | null
          user_agent?: string | null
          location_data?: Json | null
          is_active?: boolean
          last_activity_at?: string
          created_at?: string
          expires_at: string
          security_flags?: Json
        }
        Update: {
          id?: string
          user_id?: string
          session_token?: string
          device_info?: Json
          ip_address?: string | null
          user_agent?: string | null
          location_data?: Json | null
          is_active?: boolean
          last_activity_at?: string
          created_at?: string
          expires_at?: string
          security_flags?: Json
        }
      }
      user_feedback: {
        Row: {
          id: string
          user_id: string
          feedback_type: 'bug_report' | 'feature_request' | 'general' | 'ai_quality'
          title: string
          description: string
          rating: number | null
          page_url: string | null
          user_agent: string | null
          screenshot_url: string | null
          status: 'new' | 'in_review' | 'resolved' | 'closed'
          priority: 'low' | 'medium' | 'high' | 'critical'
          created_at: string
          updated_at: string
          resolved_at: string | null
          admin_notes: string | null
          admin_user_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          feedback_type: 'bug_report' | 'feature_request' | 'general' | 'ai_quality'
          title: string
          description: string
          rating?: number | null
          page_url?: string | null
          user_agent?: string | null
          screenshot_url?: string | null
          status?: 'new' | 'in_review' | 'resolved' | 'closed'
          priority?: 'low' | 'medium' | 'high' | 'critical'
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
          admin_notes?: string | null
          admin_user_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          feedback_type?: 'bug_report' | 'feature_request' | 'general' | 'ai_quality'
          title?: string
          description?: string
          rating?: number | null
          page_url?: string | null
          user_agent?: string | null
          screenshot_url?: string | null
          status?: 'new' | 'in_review' | 'resolved' | 'closed'
          priority?: 'low' | 'medium' | 'high' | 'critical'
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
          admin_notes?: string | null
          admin_user_id?: string | null
        }
      }
      schema_migrations: {
        Row: {
          version: string
          description: string | null
          applied_at: string
          checksum: string | null
        }
        Insert: {
          version: string
          description?: string | null
          applied_at?: string
          checksum?: string | null
        }
        Update: {
          version?: string
          description?: string | null
          applied_at?: string
          checksum?: string | null
        }
      }
    }
    Views: {
      user_dashboard_stats: {
        Row: {
          user_id: string
          full_name: string | null
          cpl_score: number
          subscription_status: 'free' | 'premium' | 'enterprise'
          monthly_api_usage: number
          monthly_limit: number
          total_conversations: number | null
          conversations_this_week: number | null
          total_drafts: number | null
          drafts_this_week: number | null
          accepted_drafts: number | null
          avg_cpl_score: number | null
          total_tokens_used: number | null
        }
      }
      conversation_details: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          category: 'email' | 'letter' | 'proposal' | 'memo' | 'general' | 'creative' | 'technical'
          is_archived: boolean
          is_pinned: boolean
          created_at: string
          updated_at: string
          last_activity_at: string
          context: Json
          tags: string[]
          total_drafts_generated: number
          average_cpl_score: number | null
          total_time_spent_minutes: number
          word_count: number
          input_count: number | null
          draft_count: number | null
          accepted_drafts: number | null
          rejected_drafts: number | null
          avg_cpl_score: number | null
          total_tokens: number | null
          last_draft_at: string | null
        }
      }
    }
    Functions: {
      cleanup_old_data: {
        Args: {}
        Returns: undefined
      }
      update_updated_at_column: {
        Args: {}
        Returns: unknown
      }
      update_user_activity: {
        Args: {}
        Returns: unknown
      }
      update_conversation_activity: {
        Args: {}
        Returns: unknown
      }
      update_conversation_stats: {
        Args: {}
        Returns: unknown
      }
      update_user_cpl_score: {
        Args: {}
        Returns: unknown
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Additional TypeScript types for application use
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Conversation = Database['public']['Tables']['conversations']['Row']
export type ConversationInsert = Database['public']['Tables']['conversations']['Insert']
export type ConversationUpdate = Database['public']['Tables']['conversations']['Update']

export type UserInput = Database['public']['Tables']['user_inputs']['Row']
export type UserInputInsert = Database['public']['Tables']['user_inputs']['Insert']
export type UserInputUpdate = Database['public']['Tables']['user_inputs']['Update']

export type GeneratedDraft = Database['public']['Tables']['generated_drafts']['Row']
export type GeneratedDraftInsert = Database['public']['Tables']['generated_drafts']['Insert']
export type GeneratedDraftUpdate = Database['public']['Tables']['generated_drafts']['Update']

export type ApiUsageLog = Database['public']['Tables']['api_usage_logs']['Row']
export type ApiUsageLogInsert = Database['public']['Tables']['api_usage_logs']['Insert']

export type UserSession = Database['public']['Tables']['user_sessions']['Row']
export type UserSessionInsert = Database['public']['Tables']['user_sessions']['Insert']

export type UserFeedback = Database['public']['Tables']['user_feedback']['Row']
export type UserFeedbackInsert = Database['public']['Tables']['user_feedback']['Insert']

export type UserDashboardStats = Database['public']['Views']['user_dashboard_stats']['Row']
export type ConversationDetails = Database['public']['Views']['conversation_details']['Row']

// Utility types
export type DraftType = 'grammar_fix' | 'adaptive_polish' | 'creative_enhancement' | 'tone_adjustment'
export type ConversationCategory = 'email' | 'letter' | 'proposal' | 'memo' | 'general' | 'creative' | 'technical'
export type SubscriptionStatus = 'free' | 'premium' | 'enterprise'
export type FeedbackType = 'bug_report' | 'feature_request' | 'general' | 'ai_quality'
export type FeedbackStatus = 'new' | 'in_review' | 'resolved' | 'closed'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type InputType = 'text' | 'voice' | 'document' | 'paste'

// Common interface for API responses
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// CPL-related types
export interface CPLMetrics {
  lexicalDiversity: number
  sentenceComplexity: number
  formalityLevel: number
  coherence: number
}

export interface CPLAnalysis extends CPLMetrics {
  score: number
  confidence: number
  breakdown: {
    [key: string]: number
  }
}

// Draft generation types
export interface DraftGenerationRequest {
  content: string
  category: ConversationCategory
  cplTarget?: number
  context?: Json
}

export interface DraftGenerationResponse {
  grammarFix: GeneratedDraft
  adaptivePolish: GeneratedDraft
  processingTime: number
  tokenUsage: number
  cplAlignment: number
}

// User preferences types
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: string
  notifications: boolean
  autoSave: boolean
  defaultCategory: ConversationCategory
}

export interface WritingStyleData {
  preferredComplexity: number
  vocabularyLevel: 'simple' | 'moderate' | 'advanced'
  sentenceStructure: 'simple' | 'mixed' | 'complex'
  formalityPreference: 'casual' | 'semi_formal' | 'formal'
}

export interface LearningPreferences {
  adaptationSpeed: 'conservative' | 'moderate' | 'aggressive'
  feedbackSensitivity: number
  categoryWeights: Record<ConversationCategory, number>
  recentFeedbackWindow: number // days
}