// Ascendia Database Types
// Generated from Supabase schema - January 2025
// Auto-generated types for type-safe database operations with latest schema updates

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_usage_logs: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          request_data: Json | null
          response_status: number | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          request_data?: Json | null
          response_status?: number | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          request_data?: Json | null
          response_status?: number | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          category: Database["public"]["Enums"]["conversation_category"]
          created_at: string
          id: string
          is_migrated: boolean | null
          last_activity_at: string
          metadata: Json | null
          thread_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["conversation_category"]
          created_at?: string
          id?: string
          is_migrated?: boolean | null
          last_activity_at?: string
          metadata?: Json | null
          thread_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["conversation_category"]
          created_at?: string
          id?: string
          is_migrated?: boolean | null
          last_activity_at?: string
          metadata?: Json | null
          thread_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_drafts: {
        Row: {
          content: string
          conversation_id: string | null
          cpl_score: number | null
          created_at: string
          draft_type: Database["public"]["Enums"]["draft_type"]
          id: string
          is_accepted: boolean | null
          metadata: Json | null
          thread_id: string | null
          thread_message_id: string | null
          updated_at: string
          user_edits: string | null
          user_feedback: string | null
          user_id: string
          user_input_id: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          cpl_score?: number | null
          created_at?: string
          draft_type: Database["public"]["Enums"]["draft_type"]
          id?: string
          is_accepted?: boolean | null
          metadata?: Json | null
          thread_id?: string | null
          thread_message_id?: string | null
          updated_at?: string
          user_edits?: string | null
          user_feedback?: string | null
          user_id: string
          user_input_id: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          cpl_score?: number | null
          created_at?: string
          draft_type?: Database["public"]["Enums"]["draft_type"]
          id?: string
          is_accepted?: boolean | null
          metadata?: Json | null
          thread_id?: string | null
          thread_message_id?: string | null
          updated_at?: string
          user_edits?: string | null
          user_feedback?: string | null
          user_id?: string
          user_input_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_user_input_id_fkey"
            columns: ["user_input_id"]
            isOneToOne: false
            referencedRelation: "user_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_drafts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_drafts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_drafts_thread_message_id_fkey"
            columns: ["thread_message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cpl_score: number | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          preferences: Json | null
          updated_at: string
          writing_style: Json | null
        }
        Insert: {
          avatar_url?: string | null
          cpl_score?: number | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          preferences?: Json | null
          updated_at?: string
          writing_style?: Json | null
        }
        Update: {
          avatar_url?: string | null
          cpl_score?: number | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string
          writing_style?: Json | null
        }
        Relationships: []
      }
      threads: {
        Row: {
          archived_at: string | null
          average_cpl_score: number | null
          category: string | null
          context: Json | null
          created_at: string
          description: string | null
          folder_id: string | null
          id: string
          is_active: boolean
          is_archived: boolean
          is_pinned: boolean
          last_message_at: string | null
          message_count: number | null
          name: string
          tags: string[] | null
          total_drafts_generated: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          average_cpl_score?: number | null
          category?: string | null
          context?: Json | null
          created_at?: string
          description?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_pinned?: boolean
          last_message_at?: string | null
          message_count?: number | null
          name: string
          tags?: string[] | null
          total_drafts_generated?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          average_cpl_score?: number | null
          category?: string | null
          context?: Json | null
          created_at?: string
          description?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_pinned?: boolean
          last_message_at?: string | null
          message_count?: number | null
          name?: string
          tags?: string[] | null
          total_drafts_generated?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "thread_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_folders: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_default: boolean
          is_open: boolean
          name: string
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          is_open?: boolean
          name: string
          sort_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean
          is_open?: boolean
          name?: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          edit_history: Json | null
          edited_at: string | null
          id: string
          is_deleted: boolean
          is_draft: boolean
          is_edited: boolean
          metadata: Json | null
          model_used: string | null
          parent_message_id: string | null
          position: number
          processing_time_ms: number | null
          role: string
          thread_id: string
          token_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          is_draft?: boolean
          is_edited?: boolean
          metadata?: Json | null
          model_used?: string | null
          parent_message_id?: string | null
          position: number
          processing_time_ms?: number | null
          role: string
          thread_id: string
          token_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean
          is_draft?: boolean
          is_edited?: boolean
          metadata?: Json | null
          model_used?: string | null
          parent_message_id?: string | null
          position?: number
          processing_time_ms?: number | null
          role?: string
          thread_id?: string
          token_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_analytics: {
        Row: {
          conversation_id: string | null
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_analytics_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_embeddings: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json | null
          source_id: string
          source_type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id: string
          source_type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          comment: string | null
          created_at: string
          draft_id: string | null
          feedback_type: string
          id: string
          metadata: Json | null
          rating: number | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          draft_id?: string | null
          feedback_type: string
          id?: string
          metadata?: Json | null
          rating?: number | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          draft_id?: string | null
          feedback_type?: string
          id?: string
          metadata?: Json | null
          rating?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feedback_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "generated_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_inputs: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          message_position: number | null
          metadata: Json | null
          raw_text: string | null
          thread_id: string | null
          thread_message_id: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          message_position?: number | null
          metadata?: Json | null
          raw_text?: string | null
          thread_id?: string | null
          thread_message_id?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          message_position?: number | null
          metadata?: Json | null
          raw_text?: string | null
          thread_id?: string | null
          thread_message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inputs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inputs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inputs_thread_message_id_fkey"
            columns: ["thread_message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inputs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          session_data: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          session_data?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          session_data?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          cpl_score: number | null
          created_at: string | null
          draft_type: string | null
          id: string
          is_accepted: boolean | null
          legacy_draft_id: string | null
          legacy_user_input_id: string | null
          message_type: string | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          cpl_score?: number | null
          created_at?: string | null
          draft_type?: string | null
          id?: string
          is_accepted?: boolean | null
          legacy_draft_id?: string | null
          legacy_user_input_id?: string | null
          message_type?: string | null
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          cpl_score?: number | null
          created_at?: string | null
          draft_type?: string | null
          id?: string
          is_accepted?: boolean | null
          legacy_draft_id?: string | null
          legacy_user_input_id?: string | null
          message_type?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          auto_accept_threshold: number | null
          avatar_url: string | null
          content_categories: string[] | null
          cpl_baseline: number | null
          created_at: string | null
          data_retention_days: number | null
          display_name: string | null
          enable_streaming: boolean | null
          feedback_history: Json | null
          formality_level: string | null
          id: string
          preferred_model: string | null
          response_length: string | null
          share_analytics: boolean | null
          show_cpl_scores: boolean | null
          style_patterns: Json | null
          theme: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
          vocabulary_profile: Json | null
          writing_style: Json | null
        }
        Insert: {
          auto_accept_threshold?: number | null
          avatar_url?: string | null
          content_categories?: string[] | null
          cpl_baseline?: number | null
          created_at?: string | null
          data_retention_days?: number | null
          display_name?: string | null
          enable_streaming?: boolean | null
          feedback_history?: Json | null
          formality_level?: string | null
          id?: string
          preferred_model?: string | null
          response_length?: string | null
          share_analytics?: boolean | null
          show_cpl_scores?: boolean | null
          style_patterns?: Json | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          vocabulary_profile?: Json | null
          writing_style?: Json | null
        }
        Update: {
          auto_accept_threshold?: number | null
          avatar_url?: string | null
          content_categories?: string[] | null
          cpl_baseline?: number | null
          created_at?: string | null
          data_retention_days?: number | null
          display_name?: string | null
          enable_streaming?: boolean | null
          feedback_history?: Json | null
          formality_level?: string | null
          id?: string
          preferred_model?: string | null
          response_length?: string | null
          share_analytics?: boolean | null
          show_cpl_scores?: boolean | null
          style_patterns?: Json | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          vocabulary_profile?: Json | null
          writing_style?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      conversation_category:
        | "instagram_post"
        | "linkedin"
        | "medium_article"
        | "email"
        | "conversational"
      draft_type: "grammar_fix" | "adaptive_polish"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      conversation_category: [
        "instagram_post",
        "linkedin",
        "medium_article",
        "email",
        "conversational",
      ],
      draft_type: ["grammar_fix", "adaptive_polish"],
    },
  },
} as const

// =============================================================================
// CONVENIENCE TYPE ALIASES
// =============================================================================

// Main table row types
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

export type UsageAnalytics = Database['public']['Tables']['usage_analytics']['Row']
export type UsageAnalyticsInsert = Database['public']['Tables']['usage_analytics']['Insert']
export type UsageAnalyticsUpdate = Database['public']['Tables']['usage_analytics']['Update']

export type UserFeedback = Database['public']['Tables']['user_feedback']['Row']
export type UserFeedbackInsert = Database['public']['Tables']['user_feedback']['Insert']
export type UserFeedbackUpdate = Database['public']['Tables']['user_feedback']['Update']

export type UserEmbedding = Database['public']['Tables']['user_embeddings']['Row']
export type UserEmbeddingInsert = Database['public']['Tables']['user_embeddings']['Insert']
export type UserEmbeddingUpdate = Database['public']['Tables']['user_embeddings']['Update']

export type ApiUsageLog = Database['public']['Tables']['api_usage_logs']['Row']
export type ApiUsageLogInsert = Database['public']['Tables']['api_usage_logs']['Insert']
export type ApiUsageLogUpdate = Database['public']['Tables']['api_usage_logs']['Update']

export type UserSession = Database['public']['Tables']['user_sessions']['Row']
export type UserSessionInsert = Database['public']['Tables']['user_sessions']['Insert']
export type UserSessionUpdate = Database['public']['Tables']['user_sessions']['Update']

// Thread system types
export type Thread = Database['public']['Tables']['threads']['Row']
export type ThreadInsert = Database['public']['Tables']['threads']['Insert']
export type ThreadUpdate = Database['public']['Tables']['threads']['Update']

export type ThreadMessage = Database['public']['Tables']['thread_messages']['Row']
export type ThreadMessageInsert = Database['public']['Tables']['thread_messages']['Insert']
export type ThreadMessageUpdate = Database['public']['Tables']['thread_messages']['Update']

export type ThreadFolder = Database['public']['Tables']['thread_folders']['Row']
export type ThreadFolderInsert = Database['public']['Tables']['thread_folders']['Insert']
export type ThreadFolderUpdate = Database['public']['Tables']['thread_folders']['Update']

// New consolidated schema types
export type Message = Database['public']['Tables']['messages']['Row']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']
export type MessageUpdate = Database['public']['Tables']['messages']['Update']

export type UserPreferences = Database['public']['Tables']['user_preferences']['Row']
export type UserPreferencesInsert = Database['public']['Tables']['user_preferences']['Insert']
export type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update']

// Enum types
export type ConversationCategory = Database['public']['Enums']['conversation_category']
export type DraftType = Database['public']['Enums']['draft_type']

// =============================================================================
// UTILITY TYPES FOR API RESPONSES
// =============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

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