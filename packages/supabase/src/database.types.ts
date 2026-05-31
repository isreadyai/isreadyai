export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      ai_usage: {
        Row: {
          api_key_id: string | null
          created_at: string
          generation_id: string | null
          id: string
          messages: number
          period: string
          surface: string
          tokens: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          generation_id?: string | null
          id?: string
          messages?: number
          period: string
          surface: string
          tokens?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          generation_id?: string | null
          id?: string
          messages?: number
          period?: string
          surface?: string
          tokens?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ai_usage_api_key_id_fkey'
            columns: ['api_key_id']
            isOneToOne: false
            referencedRelation: 'api_keys'
            referencedColumns: ['id']
          },
        ]
      }
      api_keys: {
        Row: {
          badge_domains: string[]
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          label: string | null
          last_used_at: string | null
          plan: string
          prefix: string | null
          revoked_at: string | null
          scopes: string[]
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          badge_domains?: string[]
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          label?: string | null
          last_used_at?: string | null
          plan?: string
          prefix?: string | null
          revoked_at?: string | null
          scopes?: string[]
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          badge_domains?: string[]
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          label?: string | null
          last_used_at?: string | null
          plan?: string
          prefix?: string | null
          revoked_at?: string | null
          scopes?: string[]
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'api_keys_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_events_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          host: string
          id: string
          messages: Json
          scan_id: string | null
          updated_at: string
          user_id: string
          website_id: string | null
        }
        Insert: {
          created_at?: string
          host: string
          id?: string
          messages?: Json
          scan_id?: string | null
          updated_at?: string
          user_id: string
          website_id?: string | null
        }
        Update: {
          created_at?: string
          host?: string
          id?: string
          messages?: Json
          scan_id?: string | null
          updated_at?: string
          user_id?: string
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'chat_threads_scan_id_fkey'
            columns: ['scan_id']
            isOneToOne: false
            referencedRelation: 'scans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'chat_threads_website_id_fkey'
            columns: ['website_id']
            isOneToOne: false
            referencedRelation: 'websites'
            referencedColumns: ['id']
          },
        ]
      }
      ci_reports: {
        Row: {
          branch: string
          commit_sha: string
          created_at: string
          grade: string | null
          id: string
          repo_id: string
          scan_id: string | null
          score: number | null
        }
        Insert: {
          branch: string
          commit_sha: string
          created_at?: string
          grade?: string | null
          id?: string
          repo_id: string
          scan_id?: string | null
          score?: number | null
        }
        Update: {
          branch?: string
          commit_sha?: string
          created_at?: string
          grade?: string | null
          id?: string
          repo_id?: string
          scan_id?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'ci_reports_repo_id_fkey'
            columns: ['repo_id']
            isOneToOne: false
            referencedRelation: 'ci_repos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ci_reports_scan_id_fkey'
            columns: ['scan_id']
            isOneToOne: false
            referencedRelation: 'scans'
            referencedColumns: ['id']
          },
        ]
      }
      ci_repos: {
        Row: {
          api_key_id: string | null
          created_at: string
          id: string
          owner_repo: string
          repository_id: string
          slug: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          id?: string
          owner_repo: string
          repository_id: string
          slug: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          id?: string
          owner_repo?: string
          repository_id?: string
          slug?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ci_repos_api_key_id_fkey'
            columns: ['api_key_id']
            isOneToOne: false
            referencedRelation: 'api_keys'
            referencedColumns: ['id']
          },
        ]
      }
      fix_runs: {
        Row: {
          api_key_id: string
          created_at: string
          id: string
          kind: string | null
          patches: number
          repo: string
          scan_id: string | null
          url: string
          workspace_id: string | null
        }
        Insert: {
          api_key_id: string
          created_at?: string
          id?: string
          kind?: string | null
          patches?: number
          repo: string
          scan_id?: string | null
          url: string
          workspace_id?: string | null
        }
        Update: {
          api_key_id?: string
          created_at?: string
          id?: string
          kind?: string | null
          patches?: number
          repo?: string
          scan_id?: string | null
          url?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fix_runs_api_key_id_fkey'
            columns: ['api_key_id']
            isOneToOne: false
            referencedRelation: 'api_keys'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fix_runs_scan_id_fkey'
            columns: ['scan_id']
            isOneToOne: false
            referencedRelation: 'scans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fix_runs_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          scan_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          scan_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          scan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'leads_scan_id_fkey'
            columns: ['scan_id']
            isOneToOne: false
            referencedRelation: 'scans'
            referencedColumns: ['id']
          },
        ]
      }
      monitoring_schedules: {
        Row: {
          alert_delta: number | null
          alert_threshold: number | null
          created_at: string
          created_by: string | null
          frequency: string
          id: string
          last_weekly_report_at: string | null
          next_run_at: string | null
          paused_at: string | null
          scan_mode: string
          smart_agent_enabled: boolean
          timezone: string
          website_id: string
        }
        Insert: {
          alert_delta?: number | null
          alert_threshold?: number | null
          created_at?: string
          created_by?: string | null
          frequency?: string
          id?: string
          last_weekly_report_at?: string | null
          next_run_at?: string | null
          paused_at?: string | null
          scan_mode?: string
          smart_agent_enabled?: boolean
          timezone?: string
          website_id: string
        }
        Update: {
          alert_delta?: number | null
          alert_threshold?: number | null
          created_at?: string
          created_by?: string | null
          frequency?: string
          id?: string
          last_weekly_report_at?: string | null
          next_run_at?: string | null
          paused_at?: string | null
          scan_mode?: string
          smart_agent_enabled?: boolean
          timezone?: string
          website_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'monitoring_schedules_website_id_fkey'
            columns: ['website_id']
            isOneToOne: false
            referencedRelation: 'websites'
            referencedColumns: ['id']
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          digest: string
          email: boolean
          event_type: string
          id: string
          in_app: boolean
          user_id: string
          webhook: boolean
          workspace_id: string
        }
        Insert: {
          created_at?: string
          digest?: string
          email?: boolean
          event_type: string
          id?: string
          in_app?: boolean
          user_id: string
          webhook?: boolean
          workspace_id: string
        }
        Update: {
          created_at?: string
          digest?: string
          email?: boolean
          event_type?: string
          id?: string
          in_app?: boolean
          user_id?: string
          webhook?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_preferences_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          payload: Json | null
          read_at: string | null
          resource_id: string | null
          resource_type: string | null
          severity: string
          title: string
          type: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: string
          title: string
          type: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: string
          title?: string
          type?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          email: string | null
          id: string
          payment_method_brand: string | null
          payment_method_last4: string | null
          plan: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_status: string | null
          terms_accepted_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          email?: string | null
          id: string
          payment_method_brand?: string | null
          payment_method_last4?: string | null
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          terms_accepted_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          email?: string | null
          id?: string
          payment_method_brand?: string | null
          payment_method_last4?: string | null
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          terms_accepted_at?: string | null
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: {
          bucket_key: string
          count: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          window_start: string
        }
        Update: {
          bucket_key?: string
          count?: number
          window_start?: string
        }
        Relationships: []
      }
      scans: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          has_deep: boolean
          has_smart: boolean
          id: string
          ip_hash: string | null
          overall_score: number | null
          report: Json | null
          site_report: Json | null
          smart_error: string | null
          smart_report: Json | null
          smart_site_report: Json | null
          smart_status: string
          source: string | null
          status: string
          url: string
          user_id: string | null
          website_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          has_deep?: boolean
          has_smart?: boolean
          id: string
          ip_hash?: string | null
          overall_score?: number | null
          report?: Json | null
          site_report?: Json | null
          smart_error?: string | null
          smart_report?: Json | null
          smart_site_report?: Json | null
          smart_status?: string
          source?: string | null
          status?: string
          url: string
          user_id?: string | null
          website_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          has_deep?: boolean
          has_smart?: boolean
          id?: string
          ip_hash?: string | null
          overall_score?: number | null
          report?: Json | null
          site_report?: Json | null
          smart_error?: string | null
          smart_report?: Json | null
          smart_site_report?: Json | null
          smart_status?: string
          source?: string | null
          status?: string
          url?: string
          user_id?: string | null
          website_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'scans_website_id_fkey'
            columns: ['website_id']
            isOneToOne: false
            referencedRelation: 'websites'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'scans_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          processed_at: string | null
          stripe_event_id: string
          type: string
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id?: string
          processed_at?: string | null
          stripe_event_id: string
          type: string
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          processed_at?: string | null
          stripe_event_id?: string
          type?: string
        }
        Relationships: []
      }
      telemetry_events: {
        Row: {
          created_at: string
          deep: boolean
          host: string | null
          id: string
          score: number | null
          smart: boolean
          source: string
        }
        Insert: {
          created_at?: string
          deep?: boolean
          host?: string | null
          id?: string
          score?: number | null
          smart?: boolean
          source: string
        }
        Update: {
          created_at?: string
          deep?: boolean
          host?: string | null
          id?: string
          score?: number | null
          smart?: boolean
          source?: string
        }
        Relationships: []
      }
      websites: {
        Row: {
          badge_enabled: boolean
          created_at: string
          created_by: string | null
          host: string
          id: string
          monitoring_enabled: boolean
          name: string | null
          public_report_id: string | null
          status: string
          verification_method: string | null
          verification_token: string | null
          verified_at: string | null
          workspace_id: string
        }
        Insert: {
          badge_enabled?: boolean
          created_at?: string
          created_by?: string | null
          host: string
          id?: string
          monitoring_enabled?: boolean
          name?: string | null
          public_report_id?: string | null
          status?: string
          verification_method?: string | null
          verification_token?: string | null
          verified_at?: string | null
          workspace_id: string
        }
        Update: {
          badge_enabled?: boolean
          created_at?: string
          created_by?: string | null
          host?: string
          id?: string
          monitoring_enabled?: boolean
          name?: string | null
          public_report_id?: string | null
          status?: string
          verification_method?: string | null
          verification_token?: string | null
          verified_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'domains_public_report_id_fkey'
            columns: ['public_report_id']
            isOneToOne: false
            referencedRelation: 'scans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'domains_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      workspace_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: string
          token_hash: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: string
          token_hash: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: string
          token_hash?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_invitations_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          last_active_at: string | null
          role: string
          seat_billable: boolean
          status: string
          suspended_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          last_active_at?: string | null
          role?: string
          seat_billable?: boolean
          status?: string
          suspended_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          last_active_at?: string | null
          role?: string
          seat_billable?: boolean
          status?: string
          suspended_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      workspaces: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          plan: string
          seat_limit: number
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_status: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          plan?: string
          seat_limit?: number
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          plan?: string
          seat_limit?: number
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cleanup: { Args: never; Returns: boolean }
      _contract_on: { Args: { '': string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: unknown[] }
      _extensions: { Args: never; Returns: unknown[] }
      _get: { Args: { '': string }; Returns: number }
      _get_latest: { Args: { '': string }; Returns: number[] }
      _get_note: { Args: { '': string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _query: { Args: { '': string }; Returns: string }
      _refine_vol: { Args: { '': string }; Returns: string }
      _retval: { Args: { '': string }; Returns: string }
      _table_privs: { Args: never; Returns: unknown[] }
      _temptypes: { Args: { '': string }; Returns: string }
      _todo: { Args: never; Returns: string }
      ai_usage_this_month: {
        Args: { p_owner: string; p_period: string; p_surface: string }
        Returns: {
          messages: number
          tokens: number
        }[]
      }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      consume_metered_run: {
        Args: {
          p_api_key_id: string
          p_kind: string
          p_limit: number
          p_patches: number
          p_repo: string
          p_url: string
          p_window_ms: number
        }
        Returns: string
      }
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_ms: number }
        Returns: boolean
      }
      delete_stale_anonymous_users: {
        Args: { p_retention_days?: number }
        Returns: number
      }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & 'Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved'
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & 'Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved'
          }
      diag_test_name: { Args: { '': string }; Returns: string }
      do_tap: { Args: never; Returns: string[] } | { Args: { '': string }; Returns: string[] }
      fail: { Args: never; Returns: string } | { Args: { '': string }; Returns: string }
      findfuncs: { Args: { '': string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      format_type_string: { Args: { '': string }; Returns: string }
      has_unique: { Args: { '': string }; Returns: string }
      in_todo: { Args: never; Returns: boolean }
      is_active_workspace_member: { Args: { ws: string }; Returns: boolean }
      is_empty: { Args: { '': string }; Returns: string }
      isnt_empty: { Args: { '': string }; Returns: string }
      lives_ok: { Args: { '': string }; Returns: string }
      no_plan: { Args: never; Returns: boolean[] }
      num_failed: { Args: never; Returns: number }
      os_name: { Args: never; Returns: string }
      pass: { Args: never; Returns: string } | { Args: { '': string }; Returns: string }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      record_ai_usage: {
        Args: {
          p_api_key_id?: string
          p_generation_id?: string
          p_messages?: number
          p_period: string
          p_surface: string
          p_tokens?: number
          p_user_id?: string
        }
        Returns: undefined
      }
      runtests: { Args: never; Returns: string[] } | { Args: { '': string }; Returns: string[] }
      skip:
        | { Args: { '': string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string }
      throws_ok: { Args: { '': string }; Returns: string }
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
      todo_end: { Args: never; Returns: boolean[] }
      todo_start: { Args: never; Returns: boolean[] } | { Args: { '': string }; Returns: boolean[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
