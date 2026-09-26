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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: Database["public"]["Enums"]["activity_action"]
          actor_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["activity_action"]
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["activity_action"]
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          notes: string | null
          staff_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          type: Database["public"]["Enums"]["appointment_type"]
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          staff_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["appointment_type"]
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          staff_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["appointment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "appointments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "expense_totals"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      case_lawyers: {
        Row: {
          assigned_at: string
          case_id: string
          is_lead: boolean
          staff_id: string
        }
        Insert: {
          assigned_at?: string
          case_id: string
          is_lead?: boolean
          staff_id: string
        }
        Update: {
          assigned_at?: string
          case_id?: string
          is_lead?: boolean
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_lawyers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_lawyers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "expense_totals"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_lawyers_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "case_lawyers_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_lawyers_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      case_notes: {
        Row: {
          case_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string | null
          id: string
          note: string
          staff_id: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          note: string
          staff_id?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          id?: string
          note?: string
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "expense_totals"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_notes_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "case_notes_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "case_notes_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_notes_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      case_opposing_parties: {
        Row: {
          case_id: string
          id: string
          name: string
          national_id: string | null
        }
        Insert: {
          case_id: string
          id?: string
          name: string
          national_id?: string | null
        }
        Update: {
          case_id?: string
          id?: string
          name?: string
          national_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_opposing_parties_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_opposing_parties_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "expense_totals"
            referencedColumns: ["case_id"]
          },
        ]
      }
      case_share_links: {
        Row: {
          access_count: number
          case_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          last_accessed_at: string | null
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          access_count?: number
          case_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          last_accessed_at?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          access_count?: number
          case_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          last_accessed_at?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_share_links_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_share_links_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "expense_totals"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "case_share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      case_statuses: {
        Row: {
          id: string
          is_terminal: boolean
          name: string
          name_ar: string | null
          sort_order: number
        }
        Insert: {
          id?: string
          is_terminal?: boolean
          name: string
          name_ar?: string | null
          sort_order?: number
        }
        Update: {
          id?: string
          is_terminal?: boolean
          name?: string
          name_ar?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      cases: {
        Row: {
          case_number: string
          case_type: string | null
          client_id: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          opened_at: string
          status_id: string
          title: string
        }
        Insert: {
          case_number: string
          case_type?: string | null
          client_id: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          opened_at?: string
          status_id: string
          title: string
        }
        Update: {
          case_number?: string
          case_type?: string | null
          client_id?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          opened_at?: string
          status_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "cases_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "case_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          national_id: string | null
          notes: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          national_id?: string | null
          notes?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          national_id?: string | null
          notes?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      conflict_checks: {
        Row: {
          id: string
          match_count: number
          ran_at: string
          ran_by: string | null
          results: Json
          searched_name: string
          searched_national_id: string | null
        }
        Insert: {
          id?: string
          match_count: number
          ran_at?: string
          ran_by?: string | null
          results: Json
          searched_name: string
          searched_national_id?: string | null
        }
        Update: {
          id?: string
          match_count?: number
          ran_at?: string
          ran_by?: string | null
          results?: Json
          searched_name?: string
          searched_national_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conflict_checks_ran_by_fkey"
            columns: ["ran_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "conflict_checks_ran_by_fkey"
            columns: ["ran_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflict_checks_ran_by_fkey"
            columns: ["ran_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      deadline_period_types: {
        Row: {
          description: string | null
          description_ar: string | null
          id: string
          name: string
          name_ar: string | null
          period_days: number
        }
        Insert: {
          description?: string | null
          description_ar?: string | null
          id?: string
          name: string
          name_ar?: string | null
          period_days: number
        }
        Update: {
          description?: string | null
          description_ar?: string | null
          id?: string
          name?: string
          name_ar?: string | null
          period_days?: number
        }
        Relationships: []
      }
      deadlines: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          effective_due_date: string | null
          extended_at: string | null
          extended_by: string | null
          extended_due_date: string | null
          extension_reason: string | null
          id: string
          period_type_id: string
          trigger_date: string
          unadjusted_due_date: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          effective_due_date?: string | null
          extended_at?: string | null
          extended_by?: string | null
          extended_due_date?: string | null
          extension_reason?: string | null
          id?: string
          period_type_id: string
          trigger_date: string
          unadjusted_due_date?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          effective_due_date?: string | null
          extended_at?: string | null
          extended_by?: string | null
          extended_due_date?: string | null
          extension_reason?: string | null
          id?: string
          period_type_id?: string
          trigger_date?: string
          unadjusted_due_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "expense_totals"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "deadlines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "deadlines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_extended_by_fkey"
            columns: ["extended_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "deadlines_extended_by_fkey"
            columns: ["extended_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_extended_by_fkey"
            columns: ["extended_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_period_type_id_fkey"
            columns: ["period_type_id"]
            isOneToOne: false
            referencedRelation: "deadline_period_types"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          case_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          filename: string
          id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          case_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          filename: string
          id?: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          filename?: string
          id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "expense_totals"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "documents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "documents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_cases: {
        Row: {
          case_id: string
          engagement_id: string
        }
        Insert: {
          case_id: string
          engagement_id: string
        }
        Update: {
          case_id?: string
          engagement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_cases_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_cases_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "expense_totals"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "engagement_cases_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement_balances"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "engagement_cases_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_installments: {
        Row: {
          amount: number
          created_at: string
          description: string
          due_date: string | null
          engagement_id: string
          id: string
          payer_name: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          due_date?: string | null
          engagement_id: string
          id?: string
          payer_name?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string | null
          engagement_id?: string
          id?: string
          payer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_installments_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement_balances"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "engagement_installments_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      engagements: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          fee_type: Database["public"]["Enums"]["fee_type"]
          fixed_amount: number | null
          id: string
          percentage: number | null
          signed_agreement_document_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          fee_type: Database["public"]["Enums"]["fee_type"]
          fixed_amount?: number | null
          id?: string
          percentage?: number | null
          signed_agreement_document_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          fee_type?: Database["public"]["Enums"]["fee_type"]
          fixed_amount?: number | null
          id?: string
          percentage?: number | null
          signed_agreement_document_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_signed_agreement_document_id_fkey"
            columns: ["signed_agreement_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiries: {
        Row: {
          assigned_to: string | null
          created_at: string
          email: string | null
          id: string
          message: string
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["enquiry_status"]
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["enquiry_status"]
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["enquiry_status"]
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "enquiries_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          case_id: string
          created_at: string
          description: string
          id: string
          incurred_at: string
          recorded_by: string | null
          reimbursed: boolean
          reimbursed_at: string | null
        }
        Insert: {
          amount: number
          case_id: string
          created_at?: string
          description: string
          id?: string
          incurred_at?: string
          recorded_by?: string | null
          reimbursed?: boolean
          reimbursed_at?: string | null
        }
        Update: {
          amount?: number
          case_id?: string
          created_at?: string
          description?: string
          id?: string
          incurred_at?: string
          recorded_by?: string | null
          reimbursed?: boolean
          reimbursed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "expense_totals"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_settings: {
        Row: {
          address_ar: string | null
          address_en: string | null
          email: string | null
          hours_ar: string | null
          hours_en: string | null
          id: string
          map_embed_url: string | null
          phone: string | null
          singleton: boolean
          updated_at: string
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          email?: string | null
          hours_ar?: string | null
          hours_en?: string | null
          id?: string
          map_embed_url?: string | null
          phone?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          email?: string | null
          hours_ar?: string | null
          hours_en?: string | null
          id?: string
          map_embed_url?: string | null
          phone?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      lawyer_profiles: {
        Row: {
          bio_ar: string | null
          bio_en: string | null
          id: string
          is_published: boolean
          name_ar: string | null
          name_en: string | null
          photo_path: string | null
          role_ar: string | null
          role_en: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          bio_ar?: string | null
          bio_en?: string | null
          id?: string
          is_published?: boolean
          name_ar?: string | null
          name_en?: string | null
          photo_path?: string | null
          role_ar?: string | null
          role_en?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bio_ar?: string | null
          bio_en?: string | null
          id?: string
          is_published?: boolean
          name_ar?: string | null
          name_en?: string | null
          photo_path?: string | null
          role_ar?: string | null
          role_en?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          end_date: string
          id: string
          staff_id: string
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          staff_id: string
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          staff_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          installment_id: string
          method: string | null
          paid_at: string
          recorded_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          installment_id: string
          method?: string | null
          paid_at?: string
          recorded_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          installment_id?: string
          method?: string | null
          paid_at?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "engagement_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installment_balances"
            referencedColumns: ["installment_id"]
          },
          {
            foreignKeyName: "payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "overdue_installments"
            referencedColumns: ["installment_id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_keys: {
        Row: {
          description: string | null
          key: string
          label: string
          owner_only: boolean
        }
        Insert: {
          description?: string | null
          key: string
          label: string
          owner_only?: boolean
        }
        Update: {
          description?: string | null
          key?: string
          label?: string
          owner_only?: boolean
        }
        Relationships: []
      }
      practice_areas: {
        Row: {
          description_ar: string | null
          description_en: string | null
          id: string
          is_published: boolean
          name_ar: string | null
          name_en: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_published?: boolean
          name_ar?: string | null
          name_en?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_published?: boolean
          name_ar?: string | null
          name_en?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          enabled: boolean
          permission_key: string
          role_id: string
        }
        Insert: {
          enabled?: boolean
          permission_key: string
          role_id: string
        }
        Update: {
          enabled?: boolean
          permission_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permission_keys"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          name: string
          name_ar: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_ar?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_ar?: string | null
        }
        Relationships: []
      }
      site_sections: {
        Row: {
          body_ar: string | null
          body_en: string | null
          eyebrow_ar: string | null
          eyebrow_en: string | null
          id: string
          intro_ar: string | null
          intro_en: string | null
          key: string
          sort_order: number
          title_ar: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          body_ar?: string | null
          body_en?: string | null
          eyebrow_ar?: string | null
          eyebrow_en?: string | null
          id?: string
          intro_ar?: string | null
          intro_en?: string | null
          key: string
          sort_order?: number
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          body_ar?: string | null
          body_en?: string | null
          eyebrow_ar?: string | null
          eyebrow_en?: string | null
          id?: string
          intro_ar?: string | null
          intro_en?: string | null
          key?: string
          sort_order?: number
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          locale: string
          must_change_password: boolean
          phone: string | null
          role_id: string | null
          temp_password_expires_at: string | null
          temp_password_set_at: string | null
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean
          locale?: string
          must_change_password?: boolean
          phone?: string | null
          role_id?: string | null
          temp_password_expires_at?: string | null
          temp_password_set_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          locale?: string
          must_change_password?: boolean
          phone?: string | null
          role_id?: string | null
          temp_password_expires_at?: string | null
          temp_password_set_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: [
          {
            foreignKeyName: "staff_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      working_hours: {
        Row: {
          day_of_week: number
          end_time: string | null
          id: string
          is_override: boolean
          staff_id: string
          start_time: string | null
        }
        Insert: {
          day_of_week: number
          end_time?: string | null
          id?: string
          is_override?: boolean
          staff_id: string
          start_time?: string | null
        }
        Update: {
          day_of_week?: number
          end_time?: string | null
          id?: string
          is_override?: boolean
          staff_id?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "lawyer_workload"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "working_hours_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_hours_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_balances: {
        Row: {
          agreed_fixed_fee_total: number | null
          client_id: string | null
          paid_total: number | null
          percentage_engagement_count: number | null
          scheduled_outstanding: number | null
          scheduled_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_summary: {
        Row: {
          collection_rate_percent: number | null
          total_outstanding: number | null
          total_paid: number | null
          total_scheduled: number | null
        }
        Relationships: []
      }
      engagement_balances: {
        Row: {
          agreed_fixed_fee: number | null
          agreed_percentage: number | null
          client_id: string | null
          engagement_id: string | null
          fee_type: Database["public"]["Enums"]["fee_type"] | null
          paid_total: number | null
          scheduled_outstanding: number | null
          scheduled_total: number | null
          unscheduled_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_totals: {
        Row: {
          case_id: string | null
          total_incurred: number | null
          total_outstanding: number | null
          total_reimbursed: number | null
        }
        Relationships: []
      }
      installment_balances: {
        Row: {
          balance_due: number | null
          engagement_id: string | null
          installment_amount: number | null
          installment_id: string | null
          paid_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_installments_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement_balances"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "engagement_installments_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyer_workload: {
        Row: {
          full_name: string | null
          is_active: boolean | null
          lead_cases: number | null
          next_deadline: string | null
          open_cases: number | null
          overdue_deadlines: number | null
          staff_id: string | null
          upcoming_deadlines: number | null
        }
        Relationships: []
      }
      overdue_installments: {
        Row: {
          balance_due: number | null
          client_id: string | null
          client_name: string | null
          days_overdue: number | null
          description: string | null
          due_date: string | null
          engagement_id: string | null
          installment_amount: number | null
          installment_id: string | null
          paid_amount: number | null
          payer_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagement_installments_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagement_balances"
            referencedColumns: ["engagement_id"]
          },
          {
            foreignKeyName: "engagement_installments_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_directory: {
        Row: {
          full_name: string | null
          id: string | null
          is_active: boolean | null
        }
        Insert: {
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
        }
        Update: {
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      case_timeline: {
        Args: { p_case_id: string }
        Returns: {
          action: Database["public"]["Enums"]["activity_action"]
          actor_id: string
          actor_name: string
          detail: Json
          detail_redacted: boolean
          entity: string
          id: number
          occurred_at: string
        }[]
      }
      check_conflict: {
        Args: { p_name: string; p_national_id?: string }
        Returns: {
          case_id: string
          matched_id: string
          matched_name: string
          source: string
        }[]
      }
      complete_password_change: { Args: never; Returns: undefined }
      create_case_share_link: {
        Args: { p_case_id: string; p_expires_days?: number; p_label?: string }
        Returns: string
      }
      current_role_id: { Args: never; Returns: string }
      get_shared_case: { Args: { p_token: string }; Returns: Json }
      has_permission: { Args: { p_key: string }; Returns: boolean }
      is_active_staff: { Args: never; Returns: boolean }
      is_on_case: { Args: { p_case_id: string }; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      name_matches: {
        Args: { p_search: string; p_target: string }
        Returns: boolean
      }
      normalize_name: { Args: { p_input: string }; Returns: string }
      password_change_pending: { Args: never; Returns: boolean }
      safe_uuid: { Args: { p: string }; Returns: string }
      search_clients: {
        Args: { p_query?: string }
        Returns: {
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          national_id: string | null
          notes: string | null
          phone: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      activity_action: "insert" | "update" | "delete"
      appointment_status: "scheduled" | "completed" | "cancelled" | "no_show"
      appointment_type: "consultation" | "court_date"
      enquiry_status: "new" | "assigned" | "resolved"
      fee_type: "fixed" | "percentage"
      leave_status: "pending" | "approved" | "rejected"
      user_type: "owner" | "staff"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      activity_action: ["insert", "update", "delete"],
      appointment_status: ["scheduled", "completed", "cancelled", "no_show"],
      appointment_type: ["consultation", "court_date"],
      enquiry_status: ["new", "assigned", "resolved"],
      fee_type: ["fixed", "percentage"],
      leave_status: ["pending", "approved", "rejected"],
      user_type: ["owner", "staff"],
    },
  },
} as const
