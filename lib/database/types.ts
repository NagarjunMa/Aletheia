export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      candidate_evidence: {
        Row: {
          actions: string;
          confirmed_at: string | null;
          context: string;
          created_at: string;
          id: string;
          kind: string;
          links: string[];
          metrics: string[];
          outcome: string;
          skills: string[];
          sort_order: number;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          actions: string;
          confirmed_at?: string | null;
          context?: string;
          created_at?: string;
          id?: string;
          kind: string;
          links?: string[];
          metrics?: string[];
          outcome?: string;
          skills?: string[];
          sort_order?: number;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          actions?: string;
          confirmed_at?: string | null;
          context?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          links?: string[];
          metrics?: string[];
          outcome?: string;
          skills?: string[];
          sort_order?: number;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_evidence_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_profiles: {
        Row: {
          availability: string;
          career_goals: string;
          created_at: string;
          current_responsibilities: string;
          current_role: string;
          excluded_claims: string[];
          github_url: string;
          linkedin_url: string;
          location: string;
          portfolio_url: string;
          relocation_preference: string;
          schema_version: number;
          startup_motivation: string;
          target_company_stages: string[];
          target_industries: string[];
          target_roles: string[];
          updated_at: string;
          user_id: string;
          work_authorization: string;
        };
        Insert: {
          availability?: string;
          career_goals?: string;
          created_at?: string;
          current_responsibilities?: string;
          current_role?: string;
          excluded_claims?: string[];
          github_url?: string;
          linkedin_url?: string;
          location?: string;
          portfolio_url?: string;
          relocation_preference?: string;
          schema_version?: number;
          startup_motivation?: string;
          target_company_stages?: string[];
          target_industries?: string[];
          target_roles?: string[];
          updated_at?: string;
          user_id: string;
          work_authorization?: string;
        };
        Update: {
          availability?: string;
          career_goals?: string;
          created_at?: string;
          current_responsibilities?: string;
          current_role?: string;
          excluded_claims?: string[];
          github_url?: string;
          linkedin_url?: string;
          location?: string;
          portfolio_url?: string;
          relocation_preference?: string;
          schema_version?: number;
          startup_motivation?: string;
          target_company_stages?: string[];
          target_industries?: string[];
          target_roles?: string[];
          updated_at?: string;
          user_id?: string;
          work_authorization?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      extension_rate_limits: {
        Row: {
          created_at: string;
          request_count: number;
          updated_at: string;
          user_id: string;
          window_start: string;
        };
        Insert: {
          created_at?: string;
          request_count?: number;
          updated_at?: string;
          user_id: string;
          window_start?: string;
        };
        Update: {
          created_at?: string;
          request_count?: number;
          updated_at?: string;
          user_id?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      generated_drafts: {
        Row: {
          content: string;
          conversation_id: string | null;
          cpl_score: number | null;
          created_at: string;
          draft_type: Database["public"]["Enums"]["draft_type"];
          feedback_at: string | null;
          id: string;
          is_accepted: boolean | null;
          metadata: Json | null;
          thread_id: string | null;
          thread_message_id: string | null;
          updated_at: string;
          user_edits: string | null;
          user_feedback: string | null;
          user_id: string;
          user_input_id: string;
        };
        Insert: {
          content: string;
          conversation_id?: string | null;
          cpl_score?: number | null;
          created_at?: string;
          draft_type: Database["public"]["Enums"]["draft_type"];
          feedback_at?: string | null;
          id?: string;
          is_accepted?: boolean | null;
          metadata?: Json | null;
          thread_id?: string | null;
          thread_message_id?: string | null;
          updated_at?: string;
          user_edits?: string | null;
          user_feedback?: string | null;
          user_id: string;
          user_input_id: string;
        };
        Update: {
          content?: string;
          conversation_id?: string | null;
          cpl_score?: number | null;
          created_at?: string;
          draft_type?: Database["public"]["Enums"]["draft_type"];
          feedback_at?: string | null;
          id?: string;
          is_accepted?: boolean | null;
          metadata?: Json | null;
          thread_id?: string | null;
          thread_message_id?: string | null;
          updated_at?: string;
          user_edits?: string | null;
          user_feedback?: string | null;
          user_id?: string;
          user_input_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drafts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_ledger: {
        Row: {
          balance_after: number;
          category: string | null;
          created_at: string;
          delta: number;
          generation_id: string | null;
          id: string;
          metadata: Json;
          reason: string;
          related_ledger_id: string | null;
          stripe_checkout_session_id: string | null;
          user_id: string;
        };
        Insert: {
          balance_after: number;
          category?: string | null;
          created_at?: string;
          delta: number;
          generation_id?: string | null;
          id?: string;
          metadata?: Json;
          reason: string;
          related_ledger_id?: string | null;
          stripe_checkout_session_id?: string | null;
          user_id: string;
        };
        Update: {
          balance_after?: number;
          category?: string | null;
          created_at?: string;
          delta?: number;
          generation_id?: string | null;
          id?: string;
          metadata?: Json;
          reason?: string;
          related_ledger_id?: string | null;
          stripe_checkout_session_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_ledger_related_ledger_id_fkey";
            columns: ["related_ledger_id"];
            isOneToOne: false;
            referencedRelation: "credit_ledger";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_ledger_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          cpl_score: number | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          preferences: Json | null;
          resume: string | null;
          resume_updated_at: string | null;
          target_job_description: string | null;
          updated_at: string;
          writing_style: Json | null;
        };
        Insert: {
          avatar_url?: string | null;
          cpl_score?: number | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          preferences?: Json | null;
          resume?: string | null;
          resume_updated_at?: string | null;
          target_job_description?: string | null;
          updated_at?: string;
          writing_style?: Json | null;
        };
        Update: {
          avatar_url?: string | null;
          cpl_score?: number | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          preferences?: Json | null;
          resume?: string | null;
          resume_updated_at?: string | null;
          target_job_description?: string | null;
          updated_at?: string;
          writing_style?: Json | null;
        };
        Relationships: [];
      };
      user_feedback: {
        Row: {
          comment: string | null;
          created_at: string;
          draft_id: string | null;
          feedback_type: string;
          id: string;
          metadata: Json | null;
          rating: number | null;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          draft_id?: string | null;
          feedback_type: string;
          id?: string;
          metadata?: Json | null;
          rating?: number | null;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          draft_id?: string | null;
          feedback_type?: string;
          id?: string;
          metadata?: Json | null;
          rating?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_feedback_draft_id_fkey";
            columns: ["draft_id"];
            isOneToOne: false;
            referencedRelation: "generated_drafts";
            referencedColumns: ["id"];
          },
        ];
      };
      user_credit_accounts: {
        Row: {
          balance: number;
          created_at: string;
          lifetime_credits_purchased: number;
          lifetime_credits_used: number;
          trial_credits_granted_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance?: number;
          created_at?: string;
          lifetime_credits_purchased?: number;
          lifetime_credits_used?: number;
          trial_credits_granted_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          created_at?: string;
          lifetime_credits_purchased?: number;
          lifetime_credits_used?: number;
          trial_credits_granted_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_credit_accounts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      resume_uploads: {
        Row: {
          completed_at: string | null;
          content_sha256: string | null;
          created_at: string;
          declared_mime: string;
          declared_size: number;
          detected_mime: string | null;
          detected_size: number | null;
          expires_at: string;
          failure_code: string | null;
          file_name: string;
          id: string;
          page_count: number | null;
          parsed_character_count: number | null;
          quality_codes: string[];
          quarantine_cleaned_at: string | null;
          quarantine_cleanup_claimed_at: string | null;
          resume_id: string | null;
          retry_count: number;
          state: string;
          storage_path: string;
          updated_at: string;
          uploaded_at: string | null;
          user_id: string;
          validation_started_at: string | null;
        };
        Insert: {
          completed_at?: string | null;
          content_sha256?: string | null;
          created_at?: string;
          declared_mime: string;
          declared_size: number;
          detected_mime?: string | null;
          detected_size?: number | null;
          expires_at?: string;
          failure_code?: string | null;
          file_name: string;
          id?: string;
          page_count?: number | null;
          parsed_character_count?: number | null;
          quality_codes?: string[];
          quarantine_cleaned_at?: string | null;
          quarantine_cleanup_claimed_at?: string | null;
          resume_id?: string | null;
          retry_count?: number;
          state?: string;
          storage_path: string;
          updated_at?: string;
          uploaded_at?: string | null;
          user_id: string;
          validation_started_at?: string | null;
        };
        Update: {
          completed_at?: string | null;
          content_sha256?: string | null;
          created_at?: string;
          declared_mime?: string;
          declared_size?: number;
          detected_mime?: string | null;
          detected_size?: number | null;
          expires_at?: string;
          failure_code?: string | null;
          file_name?: string;
          id?: string;
          page_count?: number | null;
          parsed_character_count?: number | null;
          quality_codes?: string[];
          quarantine_cleaned_at?: string | null;
          quarantine_cleanup_claimed_at?: string | null;
          resume_id?: string | null;
          retry_count?: number;
          state?: string;
          storage_path?: string;
          updated_at?: string;
          uploaded_at?: string | null;
          user_id?: string;
          validation_started_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "resume_uploads_resume_id_fkey";
            columns: ["resume_id"];
            isOneToOne: false;
            referencedRelation: "user_resumes";
            referencedColumns: ["id"];
          },
        ];
      };
      user_resumes: {
        Row: {
          created_at: string;
          file_mime: string;
          file_name: string;
          file_size: number;
          id: string;
          is_primary: boolean;
          label: string;
          parsed_text: string;
          storage_path: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          file_mime: string;
          file_name: string;
          file_size: number;
          id?: string;
          is_primary?: boolean;
          label: string;
          parsed_text: string;
          storage_path?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          file_mime?: string;
          file_name?: string;
          file_size?: number;
          id?: string;
          is_primary?: boolean;
          label?: string;
          parsed_text?: string;
          storage_path?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          approved_message_count: number | null;
          auto_accept_threshold: number | null;
          avatar_url: string | null;
          content_categories: string[] | null;
          cpl_baseline: number | null;
          created_at: string | null;
          data_retention_days: number | null;
          display_name: string | null;
          enable_streaming: boolean | null;
          feedback_history: Json | null;
          formality_level: string | null;
          id: string;
          preferred_model: string | null;
          rejected_message_count: number | null;
          response_length: string | null;
          share_analytics: boolean | null;
          show_cpl_scores: boolean | null;
          style_patterns: Json | null;
          theme: string | null;
          timezone: string | null;
          updated_at: string | null;
          user_id: string;
          vocabulary_profile: Json | null;
          writing_style: Json | null;
        };
        Insert: {
          approved_message_count?: number | null;
          auto_accept_threshold?: number | null;
          avatar_url?: string | null;
          content_categories?: string[] | null;
          cpl_baseline?: number | null;
          created_at?: string | null;
          data_retention_days?: number | null;
          display_name?: string | null;
          enable_streaming?: boolean | null;
          feedback_history?: Json | null;
          formality_level?: string | null;
          id?: string;
          preferred_model?: string | null;
          rejected_message_count?: number | null;
          response_length?: string | null;
          share_analytics?: boolean | null;
          show_cpl_scores?: boolean | null;
          style_patterns?: Json | null;
          theme?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
          user_id: string;
          vocabulary_profile?: Json | null;
          writing_style?: Json | null;
        };
        Update: {
          approved_message_count?: number | null;
          auto_accept_threshold?: number | null;
          avatar_url?: string | null;
          content_categories?: string[] | null;
          cpl_baseline?: number | null;
          created_at?: string | null;
          data_retention_days?: number | null;
          display_name?: string | null;
          enable_streaming?: boolean | null;
          feedback_history?: Json | null;
          formality_level?: string | null;
          id?: string;
          preferred_model?: string | null;
          rejected_message_count?: number | null;
          response_length?: string | null;
          share_analytics?: boolean | null;
          show_cpl_scores?: boolean | null;
          style_patterns?: Json | null;
          theme?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
          user_id?: string;
          vocabulary_profile?: Json | null;
          writing_style?: Json | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      aggregate_style_analytics: {
        Args: { end_date: string; start_date: string; target_user_id: string };
        Returns: undefined;
      };
      cancel_resume_upload: {
        Args: { p_upload_id: string };
        Returns: {
          changed: boolean;
          storage_path: string;
          upload_state: string;
        }[];
      };
      check_and_increment_rate_limit: {
        Args: { p_daily_limit?: number; p_user_id: string };
        Returns: {
          allowed: boolean;
          remaining: number;
          reset_time: string;
        }[];
      };
      claim_resume_upload: {
        Args: { p_upload_id: string; p_user_id: string };
        Returns: {
          declared_mime: string;
          declared_size: number;
          file_name: string;
          retry_count: number;
          storage_path: string;
          upload_id: string;
          user_id: string;
        }[];
      };
      complete_resume_upload: {
        Args: {
          p_content_sha256: string;
          p_detected_mime: string;
          p_detected_size: number;
          p_label: string;
          p_page_count?: number | null;
          p_parsed_text: string;
          p_quality_codes?: string[];
          p_upload_id: string;
          p_user_id: string;
        };
        Returns: {
          already_completed: boolean;
          completed_resume_id: string;
        }[];
      };
      apply_credit_purchase: {
        Args: {
          p_credits: number;
          p_metadata?: Json;
          p_stripe_checkout_session_id: string;
          p_user_id: string;
        };
        Returns: {
          applied: boolean;
          balance: number;
        }[];
      };
      cleanup_old_security_violations: { Args: never; Returns: undefined };
      ensure_credit_account: {
        Args: { p_user_id: string };
        Returns: {
          balance: number;
          lifetime_credits_purchased: number;
          lifetime_credits_used: number;
          trial_credits_granted_at: string | null;
        }[];
      };
      expire_resume_uploads: {
        Args: { p_limit?: number };
        Returns: {
          storage_path: string;
          upload_id: string;
          user_id: string;
        }[];
      };
      mark_resume_uploads_cleaned: {
        Args: { p_upload_ids: string[] };
        Returns: number;
      };
      grant_trial_credits_once: {
        Args: { p_amount?: number; p_user_id: string };
        Returns: {
          balance: number;
          granted: boolean;
        }[];
      };
      find_similar_style_vectors:
        | {
            Args: {
              match_count: number;
              match_threshold: number;
              query_embedding: string;
            };
            Returns: {
              content: string;
              id: string;
              similarity: number;
            }[];
          }
        | {
            Args: {
              max_results?: number;
              query_category?: string;
              query_embedding: string;
              query_user_id: string;
              similarity_threshold?: number;
            };
            Returns: {
              category: string;
              content: string;
              cpl_score: number;
              created_at: string;
              id: string;
              similarity: number;
            }[];
          };
      match_category_style_vectors:
        | {
            Args: {
              category_name: string;
              match_count: number;
              match_threshold: number;
              query_embedding: string;
            };
            Returns: {
              id: string;
              similarity: number;
            }[];
          }
        | {
            Args: {
              category_filter: string;
              match_count?: number;
              match_threshold?: number;
              query_embedding: string;
            };
            Returns: {
              content: string;
              cpl_score: number;
              created_at: string;
              id: string;
              is_accepted: boolean;
              quality_score: number;
              similarity: number;
              user_id: string;
              user_input: string;
            }[];
          };
      match_similar_users_style_vectors:
        | {
            Args: {
              exclude_user_id: string;
              match_count?: number;
              match_threshold?: number;
              query_embedding: string;
            };
            Returns: {
              category: string;
              content: string;
              created_at: string;
              id: string;
              quality_score: number;
              similarity: number;
              user_id: string;
            }[];
          }
        | {
            Args: {
              match_count: number;
              match_threshold: number;
              query_embedding: string;
            };
            Returns: {
              similarity: number;
              user_id: string;
            }[];
          };
      match_user_style_vectors:
        | {
            Args: {
              match_count?: number;
              match_threshold?: number;
              query_embedding: string;
              user_id: string;
            };
            Returns: {
              category: string;
              content: string;
              cpl_score: number;
              created_at: string;
              id: string;
              is_accepted: boolean;
              quality_score: number;
              similarity: number;
              user_input: string;
            }[];
          }
        | {
            Args: {
              match_count: number;
              match_threshold: number;
              query_embedding: string;
              user_id_param: string;
            };
            Returns: {
              content_id: string;
              similarity: number;
            }[];
          };
      mark_resume_upload_uploaded: {
        Args: { p_upload_id: string; p_user_id: string };
        Returns: {
          changed: boolean;
          upload_state: string;
        }[];
      };
      reject_resume_upload: {
        Args: {
          p_failure_code: string;
          p_retryable?: boolean;
          p_upload_id: string;
          p_user_id: string;
        };
        Returns: {
          changed: boolean;
          upload_state: string;
        }[];
      };
      refund_generation_credits: {
        Args: {
          p_amount: number;
          p_metadata?: Json;
          p_reservation_id: string;
          p_user_id: string;
        };
        Returns: {
          balance: number;
          refunded: boolean;
        }[];
      };
      reserve_generation_credits: {
        Args: { p_category: string; p_cost: number; p_user_id: string };
        Returns: {
          allowed: boolean;
          balance_after: number;
          reservation_id: string | null;
        }[];
      };
      reserve_resume_upload: {
        Args: {
          p_declared_mime: string;
          p_declared_size: number;
          p_file_name: string;
        };
        Returns: {
          bucket_id: string;
          expires_at: string;
          storage_path: string;
          upload_id: string;
        }[];
      };
      schedule_security_cleanup: { Args: never; Returns: undefined };
      update_vector_retrieval_stats: {
        Args: { vector_ids: string[] };
        Returns: undefined;
      };
    };
    Enums: {
      draft_type: "grammar_fix" | "adaptive_polish";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      draft_type: ["grammar_fix", "adaptive_polish"],
    },
  },
} as const;
