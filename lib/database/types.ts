// Aletheia Database Types
// Auto-generated from Supabase schema — regenerated February 2026

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_rate_limits: {
        Row: {
          created_at: string
          request_count: number
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          request_count?: number
          updated_at?: string
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          request_count?: number
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      generated_drafts: {
        Row: {
          content: string
          conversation_id: string | null
          cpl_score: number | null
          created_at: string
          draft_type: Database["public"]["Enums"]["draft_type"]
          feedback_at: string | null
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
          feedback_at?: string | null
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
          feedback_at?: string | null
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
        ]
      }
      production_metrics: {
        Row: {
          bandwidth_usage: number | null
          component: string
          cpu_usage: number | null
          created_at: string
          custom_metrics: Json | null
          error_rate: number
          id: string
          latency: number
          memory_usage: number | null
          operation_type: string | null
          request_id: string | null
          session_id: string
          system_status: string | null
          throughput: number
          timestamp: string
          trace_id: string | null
          user_id: string | null
        }
        Insert: {
          bandwidth_usage?: number | null
          component: string
          cpu_usage?: number | null
          created_at?: string
          custom_metrics?: Json | null
          error_rate?: number
          id?: string
          latency?: number
          memory_usage?: number | null
          operation_type?: string | null
          request_id?: string | null
          session_id: string
          system_status?: string | null
          throughput?: number
          timestamp?: string
          trace_id?: string | null
          user_id?: string | null
        }
        Update: {
          bandwidth_usage?: number | null
          component?: string
          cpu_usage?: number | null
          created_at?: string
          custom_metrics?: Json | null
          error_rate?: number
          id?: string
          latency?: number
          memory_usage?: number | null
          operation_type?: string | null
          request_id?: string | null
          session_id?: string
          system_status?: string | null
          throughput?: number
          timestamp?: string
          trace_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "user_inputs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          approved_message_count: number | null
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
          rejected_message_count: number | null
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
          approved_message_count?: number | null
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
          rejected_message_count?: number | null
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
          approved_message_count?: number | null
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
          rejected_message_count?: number | null
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aggregate_style_analytics:
        | { Args: never; Returns: undefined }
        | {
            Args: {
              end_date: string
              start_date: string
              target_user_id: string
            }
            Returns: undefined
          }
      cleanup_old_security_violations: { Args: never; Returns: undefined }
      find_similar_style_vectors:
        | {
            Args: {
              match_count: number
              match_threshold: number
              query_embedding: string
            }
            Returns: {
              content: string
              id: string
              similarity: number
            }[]
          }
        | {
            Args: {
              max_results?: number
              query_category?: string
              query_embedding: string
              query_user_id: string
              similarity_threshold?: number
            }
            Returns: {
              category: string
              content: string
              cpl_score: number
              created_at: string
              id: string
              similarity: number
            }[]
          }
      get_user_voice_stats: { Args: { user_id_param: string }; Returns: Json }
      match_category_style_vectors:
        | {
            Args: {
              category_name: string
              match_count: number
              match_threshold: number
              query_embedding: string
            }
            Returns: {
              id: string
              similarity: number
            }[]
          }
        | {
            Args: {
              category_filter: string
              match_count?: number
              match_threshold?: number
              query_embedding: string
            }
            Returns: {
              content: string
              cpl_score: number
              created_at: string
              id: string
              is_accepted: boolean
              quality_score: number
              similarity: number
              user_id: string
              user_input: string
            }[]
          }
      match_similar_users_style_vectors:
        | {
            Args: {
              exclude_user_id: string
              match_count?: number
              match_threshold?: number
              query_embedding: string
            }
            Returns: {
              category: string
              content: string
              created_at: string
              id: string
              quality_score: number
              similarity: number
              user_id: string
            }[]
          }
        | {
            Args: {
              match_count: number
              match_threshold: number
              query_embedding: string
            }
            Returns: {
              similarity: number
              user_id: string
            }[]
          }
      match_user_style_vectors:
        | {
            Args: {
              match_count?: number
              match_threshold?: number
              query_embedding: string
              user_id: string
            }
            Returns: {
              category: string
              content: string
              cpl_score: number
              created_at: string
              id: string
              is_accepted: boolean
              quality_score: number
              similarity: number
              user_input: string
            }[]
          }
        | {
            Args: {
              match_count: number
              match_threshold: number
              query_embedding: string
              user_id_param: string
            }
            Returns: {
              content_id: string
              similarity: number
            }[]
          }
      schedule_security_cleanup: { Args: never; Returns: undefined }
      update_vector_retrieval_stats: {
        Args: { vector_ids: string[] }
        Returns: undefined
      }
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof Database
}
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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
// CONVENIENCE TYPE ALIASES (matching actual DB tables only)
// =============================================================================

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

export type Message = Database['public']['Tables']['messages']['Row']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']
export type MessageUpdate = Database['public']['Tables']['messages']['Update']

export type UserPreferences = Database['public']['Tables']['user_preferences']['Row']
export type UserPreferencesInsert = Database['public']['Tables']['user_preferences']['Insert']
export type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update']

export type ExtensionRateLimit = Database['public']['Tables']['extension_rate_limits']['Row']
export type ExtensionRateLimitInsert = Database['public']['Tables']['extension_rate_limits']['Insert']
export type ExtensionRateLimitUpdate = Database['public']['Tables']['extension_rate_limits']['Update']

export type ProductionMetric = Database['public']['Tables']['production_metrics']['Row']
export type ProductionMetricInsert = Database['public']['Tables']['production_metrics']['Insert']
export type ProductionMetricUpdate = Database['public']['Tables']['production_metrics']['Update']

// Enum types
export type ConversationCategory = Database['public']['Enums']['conversation_category']
export type DraftType = Database['public']['Enums']['draft_type']

// =============================================================================
// UTILITY TYPES FOR API RESPONSES
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
