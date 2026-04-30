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
      accommodation_occupants: {
        Row: {
          accommodation_id: string
          id: string
          is_primary: boolean
          user_id: string
        }
        Insert: {
          accommodation_id: string
          id?: string
          is_primary?: boolean
          user_id: string
        }
        Update: {
          accommodation_id?: string
          id?: string
          is_primary?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_occupants_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_occupants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodations: {
        Row: {
          check_in: string
          check_out: string
          confirmed_by_hotel: boolean
          event_id: string
          hotel_name: string
          id: string
          room_number: string | null
          room_type: string
          special_requests: string | null
          updated_at: string
        }
        Insert: {
          check_in: string
          check_out: string
          confirmed_by_hotel?: boolean
          event_id: string
          hotel_name: string
          id?: string
          room_number?: string | null
          room_type: string
          special_requests?: string | null
          updated_at?: string
        }
        Update: {
          check_in?: string
          check_out?: string
          confirmed_by_hotel?: boolean
          event_id?: string
          hotel_name?: string
          id?: string
          room_number?: string | null
          room_type?: string
          special_requests?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      attendee_profiles: {
        Row: {
          bio: string | null
          countries_visited: string[]
          fun_fact: string | null
          hobbies: string[]
          id: string
          interests: string[]
          languages: string[]
          user_id: string
          visibility: Database["public"]["Enums"]["attendee_visibility"]
        }
        Insert: {
          bio?: string | null
          countries_visited?: string[]
          fun_fact?: string | null
          hobbies?: string[]
          id?: string
          interests?: string[]
          languages?: string[]
          user_id: string
          visibility?: Database["public"]["Enums"]["attendee_visibility"]
        }
        Update: {
          bio?: string | null
          countries_visited?: string[]
          fun_fact?: string | null
          hobbies?: string[]
          id?: string
          interests?: string[]
          languages?: string[]
          user_id?: string
          visibility?: Database["public"]["Enums"]["attendee_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "attendee_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          date_of_birth: string
          full_name: string
          id: string
          meal_tier: Database["public"]["Enums"]["child_meal_tier"] | null
          notes: string | null
          special_needs: string[]
          sponsor_id: string
        }
        Insert: {
          date_of_birth: string
          full_name: string
          id?: string
          meal_tier?: Database["public"]["Enums"]["child_meal_tier"] | null
          notes?: string | null
          special_needs?: string[]
          sponsor_id: string
        }
        Update: {
          date_of_birth?: string
          full_name?: string
          id?: string
          meal_tier?: Database["public"]["Enums"]["child_meal_tier"] | null
          notes?: string | null
          special_needs?: string[]
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      data_conflicts: {
        Row: {
          detected_at: string
          external_source: Database["public"]["Enums"]["external_source_type"]
          external_value: string | null
          field_name: string
          id: string
          kizuna_value: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["conflict_status"]
          table_name: string
          user_id: string
        }
        Insert: {
          detected_at?: string
          external_source: Database["public"]["Enums"]["external_source_type"]
          external_value?: string | null
          field_name: string
          id?: string
          kizuna_value?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["conflict_status"]
          table_name: string
          user_id: string
        }
        Update: {
          detected_at?: string
          external_source?: Database["public"]["Enums"]["external_source_type"]
          external_value?: string | null
          field_name?: string
          id?: string
          kizuna_value?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["conflict_status"]
          table_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_conflicts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_conflicts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dietary_preferences: {
        Row: {
          alcohol_free: boolean
          allergies: string[]
          id: string
          notes: string | null
          restrictions: string[]
          severity: Database["public"]["Enums"]["dietary_severity"]
          updated_at: string
          user_id: string
        }
        Insert: {
          alcohol_free?: boolean
          allergies?: string[]
          id?: string
          notes?: string | null
          restrictions?: string[]
          severity?: Database["public"]["Enums"]["dietary_severity"]
          updated_at?: string
          user_id: string
        }
        Update: {
          alcohol_free?: boolean
          allergies?: string[]
          id?: string
          notes?: string | null
          restrictions?: string[]
          severity?: Database["public"]["Enums"]["dietary_severity"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dietary_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dinner_seating: {
        Row: {
          id: string
          notes: string | null
          seat_number: number | null
          seating_group: string | null
          session_id: string
          table_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notes?: string | null
          seat_number?: number | null
          seating_group?: string | null
          session_id: string
          table_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notes?: string | null
          seat_number?: number | null
          seating_group?: string | null
          session_id?: string
          table_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dinner_seating_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dinner_seating_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_acknowledgements: {
        Row: {
          acknowledged_at: string
          device_type: string | null
          document_id: string
          document_key: string
          document_version: number
          event_id: string
          explicit_checkbox: boolean
          id: string
          ip_address: string | null
          scrolled_to_bottom: boolean
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          device_type?: string | null
          document_id: string
          document_key: string
          document_version: number
          event_id: string
          explicit_checkbox: boolean
          id?: string
          ip_address?: string | null
          scrolled_to_bottom: boolean
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          device_type?: string | null
          document_id?: string
          document_key?: string
          document_version?: number
          event_id?: string
          explicit_checkbox?: boolean
          id?: string
          ip_address?: string | null
          scrolled_to_bottom?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_acknowledgements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acknowledgements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acknowledgements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          applies_to: Database["public"]["Enums"]["document_audience"]
          body: string
          display_order: number
          document_key: string
          event_id: string | null
          id: string
          is_active: boolean
          notion_page_id: string | null
          notion_synced_at: string | null
          published_at: string
          requires_acknowledgement: boolean
          requires_scroll: boolean
          title: string
          version: number
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["document_audience"]
          body: string
          display_order?: number
          document_key: string
          event_id?: string | null
          id?: string
          is_active?: boolean
          notion_page_id?: string | null
          notion_synced_at?: string | null
          published_at?: string
          requires_acknowledgement?: boolean
          requires_scroll?: boolean
          title: string
          version?: number
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["document_audience"]
          body?: string
          display_order?: number
          document_key?: string
          event_id?: string | null
          id?: string
          is_active?: boolean
          notion_page_id?: string | null
          notion_synced_at?: string | null
          published_at?: string
          requires_acknowledgement?: boolean
          requires_scroll?: boolean
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone_primary: string
          phone_secondary: string | null
          relationship: string
          user_id: string
        }
        Insert: {
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone_primary: string
          phone_secondary?: string | null
          relationship: string
          user_id: string
        }
        Update: {
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone_primary?: string
          phone_secondary?: string | null
          relationship?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_profiles: {
        Row: {
          avatar_url: string | null
          base_city: string | null
          department: string | null
          hibob_synced_at: string | null
          home_country: string | null
          id: string
          job_title: string | null
          legal_name: string | null
          legal_name_locked: boolean
          legal_name_source: Database["public"]["Enums"]["field_source_type"]
          preferred_name: string | null
          slack_handle: string | null
          start_date: string | null
          team: string | null
          updated_at: string
          user_id: string
          years_attended: number
        }
        Insert: {
          avatar_url?: string | null
          base_city?: string | null
          department?: string | null
          hibob_synced_at?: string | null
          home_country?: string | null
          id?: string
          job_title?: string | null
          legal_name?: string | null
          legal_name_locked?: boolean
          legal_name_source?: Database["public"]["Enums"]["field_source_type"]
          preferred_name?: string | null
          slack_handle?: string | null
          start_date?: string | null
          team?: string | null
          updated_at?: string
          user_id: string
          years_attended?: number
        }
        Update: {
          avatar_url?: string | null
          base_city?: string | null
          department?: string | null
          hibob_synced_at?: string | null
          home_country?: string | null
          id?: string
          job_title?: string | null
          legal_name?: string | null
          legal_name_locked?: boolean
          legal_name_source?: Database["public"]["Enums"]["field_source_type"]
          preferred_name?: string | null
          slack_handle?: string | null
          start_date?: string | null
          team?: string | null
          updated_at?: string
          user_id?: string
          years_attended?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          end_date: string
          hero_image_url: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          reg_closes_at: string | null
          reg_opens_at: string | null
          start_date: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Insert: {
          end_date: string
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          reg_closes_at?: string | null
          reg_opens_at?: string | null
          start_date: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Update: {
          end_date?: string
          hero_image_url?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          reg_closes_at?: string | null
          reg_opens_at?: string | null
          start_date?: string
          type?: Database["public"]["Enums"]["event_type"]
        }
        Relationships: []
      }
      flights: {
        Row: {
          airline: string | null
          arrival_at: string
          cost: number | null
          departure_at: string
          destination: string
          direction: Database["public"]["Enums"]["flight_direction"]
          flight_number: string | null
          id: string
          is_confirmed: boolean
          last_synced_at: string | null
          origin: string
          perk_booking_ref: string | null
          source: Database["public"]["Enums"]["flight_source_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          airline?: string | null
          arrival_at: string
          cost?: number | null
          departure_at: string
          destination: string
          direction: Database["public"]["Enums"]["flight_direction"]
          flight_number?: string | null
          id?: string
          is_confirmed?: boolean
          last_synced_at?: string | null
          origin: string
          perk_booking_ref?: string | null
          source: Database["public"]["Enums"]["flight_source_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          airline?: string | null
          arrival_at?: string
          cost?: number | null
          departure_at?: string
          destination?: string
          direction?: Database["public"]["Enums"]["flight_direction"]
          flight_number?: string | null
          id?: string
          is_confirmed?: boolean
          last_synced_at?: string | null
          origin?: string
          perk_booking_ref?: string | null
          source?: Database["public"]["Enums"]["flight_source_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_invitations: {
        Row: {
          accepted_at: string | null
          created_user_id: string | null
          expires_at: string
          guest_email: string
          id: string
          sent_at: string
          signed_token: string
          sponsor_id: string
          status: Database["public"]["Enums"]["guest_invitation_status"]
        }
        Insert: {
          accepted_at?: string | null
          created_user_id?: string | null
          expires_at: string
          guest_email: string
          id?: string
          sent_at?: string
          signed_token: string
          sponsor_id: string
          status?: Database["public"]["Enums"]["guest_invitation_status"]
        }
        Update: {
          accepted_at?: string | null
          created_user_id?: string | null
          expires_at?: string
          guest_email?: string
          id?: string
          sent_at?: string
          signed_token?: string
          sponsor_id?: string
          status?: Database["public"]["Enums"]["guest_invitation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "guest_invitations_created_user_id_fkey"
            columns: ["created_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_invitations_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_profiles: {
        Row: {
          fee_amount: number | null
          full_name: string
          id: string
          legal_name: string
          payment_status: Database["public"]["Enums"]["guest_payment_status"]
          perk_profile_created: boolean
          relationship: Database["public"]["Enums"]["guest_relationship"]
          sponsor_id: string
          stripe_payment_id: string | null
          user_id: string
        }
        Insert: {
          fee_amount?: number | null
          full_name: string
          id?: string
          legal_name: string
          payment_status?: Database["public"]["Enums"]["guest_payment_status"]
          perk_profile_created?: boolean
          relationship: Database["public"]["Enums"]["guest_relationship"]
          sponsor_id: string
          stripe_payment_id?: string | null
          user_id: string
        }
        Update: {
          fee_amount?: number | null
          full_name?: string
          id?: string
          legal_name?: string
          payment_status?: Database["public"]["Enums"]["guest_payment_status"]
          perk_profile_created?: boolean
          relationship?: Database["public"]["Enums"]["guest_relationship"]
          sponsor_id?: string
          stripe_payment_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_profiles_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hibob_sync_log: {
        Row: {
          conflicts_created: number
          error_detail: Json | null
          id: string
          records_processed: number
          records_skipped: number
          records_updated: number
          status: Database["public"]["Enums"]["sync_status"]
          sync_completed_at: string | null
          sync_started_at: string
        }
        Insert: {
          conflicts_created?: number
          error_detail?: Json | null
          id?: string
          records_processed?: number
          records_skipped?: number
          records_updated?: number
          status?: Database["public"]["Enums"]["sync_status"]
          sync_completed_at?: string | null
          sync_started_at?: string
        }
        Update: {
          conflicts_created?: number
          error_detail?: Json | null
          id?: string
          records_processed?: number
          records_skipped?: number
          records_updated?: number
          status?: Database["public"]["Enums"]["sync_status"]
          sync_completed_at?: string | null
          sync_started_at?: string
        }
        Relationships: []
      }
      itinerary_items: {
        Row: {
          ends_at: string | null
          event_id: string
          id: string
          includes_guest: boolean
          is_conflict: boolean
          is_offline_cached: boolean
          item_type: Database["public"]["Enums"]["itinerary_item_type"]
          source: Database["public"]["Enums"]["itinerary_source"]
          source_id: string | null
          starts_at: string
          subtitle: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ends_at?: string | null
          event_id: string
          id?: string
          includes_guest?: boolean
          is_conflict?: boolean
          is_offline_cached?: boolean
          item_type: Database["public"]["Enums"]["itinerary_item_type"]
          source: Database["public"]["Enums"]["itinerary_source"]
          source_id?: string | null
          starts_at: string
          subtitle?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ends_at?: string | null
          event_id?: string
          id?: string
          includes_guest?: boolean
          is_conflict?: boolean
          is_offline_cached?: boolean
          item_type?: Database["public"]["Enums"]["itinerary_item_type"]
          source?: Database["public"]["Enums"]["itinerary_source"]
          source_id?: string | null
          starts_at?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel: string
          deleted_at: string | null
          id: string
          media_url: string | null
          reactions: Json
          reply_to_id: string | null
          sender_id: string
          sent_at: string
        }
        Insert: {
          body: string
          channel: string
          deleted_at?: string | null
          id?: string
          media_url?: string | null
          reactions?: Json
          reply_to_id?: string | null
          sender_id: string
          sent_at?: string
        }
        Update: {
          body?: string
          channel?: string
          deleted_at?: string | null
          id?: string
          media_url?: string | null
          reactions?: Json
          reply_to_id?: string | null
          sender_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          delivered: boolean
          event_id: string | null
          id: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          sent_at: string
          sent_by: string | null
          subject: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          delivered?: boolean
          event_id?: string | null
          id?: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          sent_at?: string
          sent_by?: string | null
          subject: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          delivered?: boolean
          event_id?: string | null
          id?: string
          notification_type?: Database["public"]["Enums"]["notification_type"]
          sent_at?: string
          sent_by?: string | null
          subject?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "registration_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_details: {
        Row: {
          expiry_date: string
          id: string
          issuing_country: string
          passport_name: string
          passport_number_encrypted: string
          updated_at: string
          user_id: string
        }
        Insert: {
          expiry_date: string
          id?: string
          issuing_country: string
          passport_name: string
          passport_number_encrypted: string
          updated_at?: string
          user_id: string
        }
        Update: {
          expiry_date?: string
          id?: string
          issuing_country?: string
          passport_name?: string
          passport_number_encrypted?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passport_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_custom_fields: {
        Row: {
          applies_to: Database["public"]["Enums"]["custom_field_audience"]
          display_order: number
          event_id: string
          field_key: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          hint: string | null
          id: string
          is_required: boolean
          label: string
          options: string[]
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["custom_field_audience"]
          display_order?: number
          event_id: string
          field_key: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          hint?: string | null
          id?: string
          is_required?: boolean
          label: string
          options?: string[]
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["custom_field_audience"]
          display_order?: number
          event_id?: string
          field_key?: string
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          hint?: string | null
          id?: string
          is_required?: boolean
          label?: string
          options?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "profile_custom_fields_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_field_responses: {
        Row: {
          event_id: string
          field_id: string
          id: string
          updated_at: string
          user_id: string
          value: string | null
        }
        Insert: {
          event_id: string
          field_id: string
          id?: string
          updated_at?: string
          user_id: string
          value?: string | null
        }
        Update: {
          event_id?: string
          field_id?: string
          id?: string
          updated_at?: string
          user_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_field_responses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_field_responses_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "profile_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_field_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_tasks: {
        Row: {
          applies_to: Database["public"]["Enums"]["task_audience"]
          completed_at: string | null
          deadline: string | null
          id: string
          is_auto_completed: boolean
          last_nudge_at: string | null
          nudge_count: number
          registration_id: string
          status: Database["public"]["Enums"]["registration_task_status"]
          task_key: Database["public"]["Enums"]["registration_task_key"]
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["task_audience"]
          completed_at?: string | null
          deadline?: string | null
          id?: string
          is_auto_completed?: boolean
          last_nudge_at?: string | null
          nudge_count?: number
          registration_id: string
          status?: Database["public"]["Enums"]["registration_task_status"]
          task_key: Database["public"]["Enums"]["registration_task_key"]
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["task_audience"]
          completed_at?: string | null
          deadline?: string | null
          id?: string
          is_auto_completed?: boolean
          last_nudge_at?: string | null
          nudge_count?: number
          registration_id?: string
          status?: Database["public"]["Enums"]["registration_task_status"]
          task_key?: Database["public"]["Enums"]["registration_task_key"]
        }
        Relationships: [
          {
            foreignKeyName: "registration_tasks_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          completion_pct: number
          created_at: string
          event_id: string
          id: string
          qr_token: string | null
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          completion_pct?: number
          created_at?: string
          event_id: string
          id?: string
          qr_token?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          completion_pct?: number
          created_at?: string
          event_id?: string
          id?: string
          qr_token?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      report_snapshots: {
        Row: {
          event_id: string
          generated_at: string
          generated_by: string | null
          id: string
          notes: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          share_expires_at: string | null
          share_token: string | null
        }
        Insert: {
          event_id: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          notes?: string | null
          report_type: Database["public"]["Enums"]["report_type"]
          share_expires_at?: string | null
          share_token?: string | null
        }
        Update: {
          event_id?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          notes?: string | null
          report_type?: Database["public"]["Enums"]["report_type"]
          share_expires_at?: string | null
          share_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_snapshots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_snapshots_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_registrations: {
        Row: {
          id: string
          includes_guest: boolean
          registered_at: string
          session_id: string
          status: Database["public"]["Enums"]["session_registration_status"]
          user_id: string
        }
        Insert: {
          id?: string
          includes_guest?: boolean
          registered_at?: string
          session_id: string
          status?: Database["public"]["Enums"]["session_registration_status"]
          user_id: string
        }
        Update: {
          id?: string
          includes_guest?: boolean
          registered_at?: string
          session_id?: string
          status?: Database["public"]["Enums"]["session_registration_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_registrations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          audience: Database["public"]["Enums"]["session_audience"]
          capacity: number | null
          description: string | null
          ends_at: string
          event_id: string
          id: string
          is_mandatory: boolean
          location: string | null
          starts_at: string
          title: string
          type: Database["public"]["Enums"]["session_type"]
          updated_at: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["session_audience"]
          capacity?: number | null
          description?: string | null
          ends_at: string
          event_id: string
          id?: string
          is_mandatory?: boolean
          location?: string | null
          starts_at: string
          title: string
          type: Database["public"]["Enums"]["session_type"]
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["session_audience"]
          capacity?: number | null
          description?: string | null
          ends_at?: string
          event_id?: string
          id?: string
          is_mandatory?: boolean
          location?: string | null
          starts_at?: string
          title?: string
          type?: Database["public"]["Enums"]["session_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      swag_items: {
        Row: {
          available_sizes: string[]
          description: string | null
          display_order: number
          event_id: string
          has_fit_options: boolean
          id: string
          name: string
          requires_sizing: boolean
          sizing_guide_url: string | null
        }
        Insert: {
          available_sizes?: string[]
          description?: string | null
          display_order?: number
          event_id: string
          has_fit_options?: boolean
          id?: string
          name: string
          requires_sizing?: boolean
          sizing_guide_url?: string | null
        }
        Update: {
          available_sizes?: string[]
          description?: string | null
          display_order?: number
          event_id?: string
          has_fit_options?: boolean
          id?: string
          name?: string
          requires_sizing?: boolean
          sizing_guide_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "swag_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      swag_selections: {
        Row: {
          exchange_notes: string | null
          fit_preference: string | null
          fulfilled: boolean
          id: string
          opted_in: boolean
          size: string | null
          swag_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          exchange_notes?: string | null
          fit_preference?: string | null
          fulfilled?: boolean
          id?: string
          opted_in?: boolean
          size?: string | null
          swag_item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          exchange_notes?: string | null
          fit_preference?: string | null
          fulfilled?: boolean
          id?: string
          opted_in?: boolean
          size?: string | null
          swag_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swag_selections_swag_item_id_fkey"
            columns: ["swag_item_id"]
            isOneToOne: false
            referencedRelation: "swag_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swag_selections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_requests: {
        Row: {
          assigned_vehicle_id: string | null
          bag_count: number
          direction: Database["public"]["Enums"]["transport_direction"]
          flight_id: string | null
          id: string
          needs_review: boolean
          passenger_count: number
          pickup_datetime: string
          special_equipment: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_vehicle_id?: string | null
          bag_count?: number
          direction: Database["public"]["Enums"]["transport_direction"]
          flight_id?: string | null
          id?: string
          needs_review?: boolean
          passenger_count: number
          pickup_datetime: string
          special_equipment?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_vehicle_id?: string | null
          bag_count?: number
          direction?: Database["public"]["Enums"]["transport_direction"]
          flight_id?: string | null
          id?: string
          needs_review?: boolean
          passenger_count?: number
          pickup_datetime?: string
          special_equipment?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_requests_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "transport_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_vehicles: {
        Row: {
          capacity_bags: number
          capacity_passengers: number
          event_id: string
          handles_special_equipment: string[]
          id: string
          notes: string | null
          provider: string | null
          vehicle_name: string
        }
        Insert: {
          capacity_bags: number
          capacity_passengers: number
          event_id: string
          handles_special_equipment?: string[]
          id?: string
          notes?: string | null
          provider?: string | null
          vehicle_name: string
        }
        Update: {
          capacity_bags?: number
          capacity_passengers?: number
          event_id?: string
          handles_special_equipment?: string[]
          id?: string
          notes?: string | null
          provider?: string | null
          vehicle_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_vehicles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_provider: Database["public"]["Enums"]["auth_provider"]
          created_at: string
          email: string
          hibob_id: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          sponsor_id: string | null
        }
        Insert: {
          auth_provider: Database["public"]["Enums"]["auth_provider"]
          created_at?: string
          email: string
          hibob_id?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sponsor_id?: string | null
        }
        Update: {
          auth_provider?: Database["public"]["Enums"]["auth_provider"]
          created_at?: string
          email?: string
          hibob_id?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sponsor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["vote_target_type"]
          user_id: string
          value: number
        }
        Insert: {
          id?: string
          target_id: string
          target_type: Database["public"]["Enums"]["vote_target_type"]
          user_id: string
          value: number
        }
        Update: {
          id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["vote_target_type"]
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_role: { Args: never; Returns: string }
      channel_has_access: {
        Args: { p_channel: string; p_uid: string }
        Returns: boolean
      }
      current_active_event_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_passport_number: { Args: { p_user_id: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_self_or_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      set_passport: {
        Args: {
          p_expiry_date: string
          p_issuing_country: string
          p_passport_name: string
          p_passport_number: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      attendee_visibility: "public" | "attendees_only" | "private"
      auth_provider: "sso" | "email_password"
      child_meal_tier: "free" | "half" | "full"
      conflict_status:
        | "open"
        | "accepted_kizuna"
        | "accepted_external"
        | "pushed_to_source"
      custom_field_audience: "all" | "employee" | "guest"
      custom_field_type: "text" | "select" | "boolean" | "number" | "date"
      dietary_severity: "preference" | "intolerance" | "allergy"
      document_audience: "all" | "employee" | "guest"
      event_type: "supafest" | "select" | "meetup"
      external_source_type: "hibob" | "perk"
      field_source_type: "hibob" | "perk" | "user_entered" | "admin_set"
      flight_direction: "inbound" | "outbound"
      flight_source_type: "perk_sync" | "perk_csv" | "manual_obs"
      guest_invitation_status: "pending" | "accepted" | "expired" | "cancelled"
      guest_payment_status:
        | "pending"
        | "paid"
        | "waived"
        | "refunded"
        | "failed"
      guest_relationship: "partner" | "family" | "friend" | "other"
      itinerary_item_type:
        | "session"
        | "flight"
        | "transport"
        | "accommodation"
        | "announcement"
        | "reminder"
      itinerary_source: "assigned" | "self_registered" | "auto_all"
      notification_channel: "slack" | "email" | "in_app"
      notification_type:
        | "nudge"
        | "deadline_reminder"
        | "flight_update"
        | "room_assignment"
        | "announcement"
        | "checkin_reminder"
      registration_status: "invited" | "started" | "complete" | "cancelled"
      registration_task_key:
        | "personal_info"
        | "passport"
        | "emergency_contact"
        | "dietary"
        | "swag"
        | "transport"
        | "guest"
        | "documents"
        | "flight"
      registration_task_status: "pending" | "complete" | "skipped" | "waived"
      report_type:
        | "rooming_list"
        | "transport_manifest"
        | "dietary_summary"
        | "swag_order"
        | "full_registration"
        | "payment_reconciliation"
      session_audience: "all" | "employees_only" | "guests_only" | "opt_in"
      session_registration_status:
        | "registered"
        | "waitlisted"
        | "attended"
        | "no_show"
      session_type:
        | "keynote"
        | "breakout"
        | "workshop"
        | "dinner"
        | "activity"
        | "transport"
        | "social"
      sync_status: "success" | "partial" | "failed"
      task_audience: "all" | "employee_only" | "guest_only"
      transport_direction: "arrival" | "departure"
      user_role: "employee" | "guest" | "admin" | "super_admin"
      vote_target_type: "session" | "idea" | "announcement"
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
      attendee_visibility: ["public", "attendees_only", "private"],
      auth_provider: ["sso", "email_password"],
      child_meal_tier: ["free", "half", "full"],
      conflict_status: [
        "open",
        "accepted_kizuna",
        "accepted_external",
        "pushed_to_source",
      ],
      custom_field_audience: ["all", "employee", "guest"],
      custom_field_type: ["text", "select", "boolean", "number", "date"],
      dietary_severity: ["preference", "intolerance", "allergy"],
      document_audience: ["all", "employee", "guest"],
      event_type: ["supafest", "select", "meetup"],
      external_source_type: ["hibob", "perk"],
      field_source_type: ["hibob", "perk", "user_entered", "admin_set"],
      flight_direction: ["inbound", "outbound"],
      flight_source_type: ["perk_sync", "perk_csv", "manual_obs"],
      guest_invitation_status: ["pending", "accepted", "expired", "cancelled"],
      guest_payment_status: ["pending", "paid", "waived", "refunded", "failed"],
      guest_relationship: ["partner", "family", "friend", "other"],
      itinerary_item_type: [
        "session",
        "flight",
        "transport",
        "accommodation",
        "announcement",
        "reminder",
      ],
      itinerary_source: ["assigned", "self_registered", "auto_all"],
      notification_channel: ["slack", "email", "in_app"],
      notification_type: [
        "nudge",
        "deadline_reminder",
        "flight_update",
        "room_assignment",
        "announcement",
        "checkin_reminder",
      ],
      registration_status: ["invited", "started", "complete", "cancelled"],
      registration_task_key: [
        "personal_info",
        "passport",
        "emergency_contact",
        "dietary",
        "swag",
        "transport",
        "guest",
        "documents",
        "flight",
      ],
      registration_task_status: ["pending", "complete", "skipped", "waived"],
      report_type: [
        "rooming_list",
        "transport_manifest",
        "dietary_summary",
        "swag_order",
        "full_registration",
        "payment_reconciliation",
      ],
      session_audience: ["all", "employees_only", "guests_only", "opt_in"],
      session_registration_status: [
        "registered",
        "waitlisted",
        "attended",
        "no_show",
      ],
      session_type: [
        "keynote",
        "breakout",
        "workshop",
        "dinner",
        "activity",
        "transport",
        "social",
      ],
      sync_status: ["success", "partial", "failed"],
      task_audience: ["all", "employee_only", "guest_only"],
      transport_direction: ["arrival", "departure"],
      user_role: ["employee", "guest", "admin", "super_admin"],
      vote_target_type: ["session", "idea", "announcement"],
    },
  },
} as const

