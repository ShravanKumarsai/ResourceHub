export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type Table<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type Institution = {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type Membership = {
  id: string
  institution_id: string
  user_id: string | null
  status: string
  requested_role: string | null
  requested_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  verified_at: string | null
  verified_by: string | null
  created_at: string
  updated_at: string
}

type MembershipInsert = Partial<
  Omit<Membership, 'id' | 'requested_at' | 'created_at' | 'updated_at'>
> & {
  id?: string
  institution_id?: string
  user_id?: string | null
  status?: string
  requested_role?: string | null
  requested_at?: string
  reviewed_at?: string | null
  reviewed_by?: string | null
  verified_at?: string | null
  verified_by?: string | null
  created_at?: string
  updated_at?: string
}

type Resource = {
  id: string
  institution_id: string
  owner_membership_id: string
  owner_user_id: string
  owner_name: string
  name: string
  category: string
  location: string
  description: string
  image_path: string | null
  specifications: Json
  highlights: string[]
  availability: string
  hourly_rate: number
  max_duration_hours: number
  approval_mode: string
  eligibility: string[]
  training: string[]
  safety: string[]
  use_cases: string[]
  instructions: string[]
  listed: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

type ResourceInsert = Omit<
  Resource,
  'id' | 'owner_name' | 'created_at' | 'updated_at' | 'archived_at'
> & {
  id?: string
  owner_name?: string
  image_path?: string | null
  specifications?: Json
  highlights?: string[]
  availability?: string
  hourly_rate?: number
  max_duration_hours?: number
  approval_mode?: string
  eligibility?: string[]
  training?: string[]
  safety?: string[]
  use_cases?: string[]
  instructions?: string[]
  listed?: boolean
  archived_at?: string | null
}

export type Database = {
  public: {
    Tables: {
      institutions: Table<
        Institution,
        Omit<Institution, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        },
        Partial<Institution>
      >
      profiles: Table<
        { id: string; display_name: string | null; title: string | null; department: string | null; created_at: string; updated_at: string },
        { id: string; display_name?: string | null; title?: string | null; department?: string | null; created_at?: string; updated_at?: string },
        Partial<{ display_name: string | null; title: string | null; department: string | null; updated_at: string }>
      >
      institution_memberships: Table<
        Membership,
        MembershipInsert,
        Partial<Membership>
      >
      institution_membership_roles: Table<
        { membership_id: string; role: string; granted_at: string; granted_by: string | null },
        { membership_id: string; role: string; granted_at?: string; granted_by?: string | null },
        Partial<{ membership_id: string; role: string; granted_at: string; granted_by: string | null }>
      >
      institution_membership_events: Table<
        {
          id: string
          membership_id: string | null
          institution_id: string
          actor_id: string | null
          from_status: string | null
          to_status: string
          from_roles: string[]
          to_roles: string[]
          created_at: string
          action: string
          actor_kind: string
          actor_principal: string | null
        },
        {
          id?: string
          membership_id?: string | null
          institution_id: string
          actor_id?: string | null
          from_status?: string | null
          to_status: string
          from_roles?: string[]
          to_roles?: string[]
          created_at?: string
          action?: string
          actor_kind?: string
          actor_principal?: string | null
        },
        Partial<{
          membership_id: string | null
          institution_id: string
          actor_id: string | null
          from_status: string | null
          to_status: string
          from_roles: string[]
          to_roles: string[]
          created_at: string
          action: string
          actor_kind: string
          actor_principal: string | null
        }>
      >
      resources: Table<Resource, ResourceInsert, Partial<ResourceInsert>>
      resource_favorites: Table<
        { user_id: string; resource_id: string; created_at: string },
        { user_id: string; resource_id: string; created_at?: string },
        Partial<{ user_id: string; resource_id: string; created_at: string }>
      >
      bookings: Table<
        { id: string; institution_id: string; resource_id: string; requester_membership_id: string; requester_user_id: string; starts_at: string; ends_at: string; purpose: string; status: string; decision_note: string | null; reviewed_by: string | null; reviewed_at: string | null; cancelled_at: string | null; created_at: string; updated_at: string },
        { id?: string; institution_id: string; resource_id: string; requester_membership_id: string; requester_user_id: string; starts_at: string; ends_at: string; purpose: string; status?: string; decision_note?: string | null; reviewed_by?: string | null; reviewed_at?: string | null; cancelled_at?: string | null; created_at?: string; updated_at?: string },
        Partial<{ institution_id: string; resource_id: string; requester_membership_id: string; requester_user_id: string; starts_at: string; ends_at: string; purpose: string; status: string; decision_note: string | null; reviewed_by: string | null; reviewed_at: string | null; cancelled_at: string | null; updated_at: string }>
      >
      condition_reports: Table<
        { id: string; booking_id: string; phase: string; rating: string; notes: string; checklist: string[]; recorded_by: string; recorded_at: string },
        { id?: string; booking_id: string; phase: string; rating: string; notes?: string; checklist: string[]; recorded_by: string; recorded_at?: string },
        Partial<{ booking_id: string; phase: string; rating: string; notes: string; checklist: string[]; recorded_by: string; recorded_at: string }>
      >
      incidents: Table<
        { id: string; institution_id: string; resource_id: string; booking_id: string | null; reporter_membership_id: string; reporter_user_id: string; severity: string; status: string; title: string; description: string; created_at: string; updated_at: string },
        { id?: string; institution_id: string; resource_id: string; booking_id?: string | null; reporter_membership_id: string; reporter_user_id: string; severity: string; status?: string; title: string; description: string; created_at?: string; updated_at?: string },
        Partial<{ institution_id: string; resource_id: string; booking_id: string | null; reporter_membership_id: string; reporter_user_id: string; severity: string; status: string; title: string; description: string; updated_at: string }>
      >
      incident_events: Table<
        { id: string; incident_id: string; institution_id: string; actor_id: string | null; from_status: string | null; to_status: string; note: string; created_at: string },
        { id?: string; incident_id: string; institution_id: string; actor_id?: string | null; from_status?: string | null; to_status: string; note?: string; created_at?: string },
        Partial<{ incident_id: string; institution_id: string; actor_id: string | null; from_status: string | null; to_status: string; note: string; created_at: string }>
      >
      waiting_list_entries: Table<
        { id: string; institution_id: string; resource_id: string; requester_membership_id: string; requester_user_id: string; starts_at: string; ends_at: string; status: string; created_at: string; updated_at: string },
        { id?: string; institution_id: string; resource_id: string; requester_membership_id: string; requester_user_id: string; starts_at: string; ends_at: string; status?: string; created_at?: string; updated_at?: string },
        Partial<{ institution_id: string; resource_id: string; requester_membership_id: string; requester_user_id: string; starts_at: string; ends_at: string; status: string; updated_at: string }>
      >
      activity_events: Table<
        { id: string; institution_id: string; actor_id: string | null; resource_id: string | null; booking_id: string | null; incident_id: string | null; event_type: string; summary: string; metadata: Json; created_at: string },
        { id?: string; institution_id: string; actor_id?: string | null; resource_id?: string | null; booking_id?: string | null; incident_id?: string | null; event_type: string; summary: string; metadata?: Json; created_at?: string },
        Partial<{ institution_id: string; actor_id: string | null; resource_id: string | null; booking_id: string | null; incident_id: string | null; event_type: string; summary: string; metadata: Json; created_at: string }>
      >
      notifications: Table<
        { id: string; recipient_id: string; institution_id: string; activity_event_id: string | null; title: string; body: string; created_at: string; read_at: string | null },
        { id?: string; recipient_id: string; institution_id: string; activity_event_id?: string | null; title: string; body: string; created_at?: string; read_at?: string | null },
        Partial<{ recipient_id: string; institution_id: string; activity_event_id: string | null; title: string; body: string; read_at: string }>
      >
      notification_preferences: Table<
        { user_id: string; email_enabled: boolean; push_enabled: boolean; updated_at: string },
        { user_id: string; email_enabled?: boolean; push_enabled?: boolean; updated_at?: string },
        Partial<{ email_enabled: boolean; push_enabled: boolean; updated_at: string }>
      >
      notification_push_subscriptions: Table<
        { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; created_at: string; updated_at: string },
        { id?: string; user_id: string; endpoint: string; p256dh: string; auth: string; created_at?: string; updated_at?: string },
        Partial<{ user_id: string; endpoint: string; p256dh: string; auth: string; updated_at: string }>
      >
      notification_delivery_jobs: Table<
        { id: string; notification_id: string; recipient_id: string; channel: string; status: string; attempts: number; next_attempt_at: string; locked_until: string | null; last_error: string | null; provider_message_id: string | null; created_at: string; delivered_at: string | null },
        { id?: string; notification_id: string; recipient_id: string; channel: string; status?: string; attempts?: number; next_attempt_at?: string; locked_until?: string | null; last_error?: string | null; provider_message_id?: string | null; created_at?: string; delivered_at?: string | null },
        Partial<{ status: string; attempts: number; next_attempt_at: string; locked_until: string | null; last_error: string | null; provider_message_id: string | null; delivered_at: string | null }>
      >
    }
    Views: Record<string, never>
    Functions: {
      request_resource_booking: { Args: { p_resource_id: string; p_starts_at: string; p_ends_at: string; p_purpose: string; p_idempotency_key?: string }; Returns: string }
      get_institution_reservation_limits: { Args: { p_institution_id: string }; Returns: { max_active_reservations_per_user: number; max_concurrent_resources_per_user: number }[] }
      set_institution_reservation_limits: { Args: { p_institution_id: string; p_max_active_reservations: number; p_max_concurrent_resources: number }; Returns: undefined }
      review_resource_booking: { Args: { p_booking_id: string; p_decision: string; p_note?: string | null }; Returns: undefined }
      cancel_resource_booking: { Args: { p_booking_id: string }; Returns: undefined }
      record_booking_condition_report: { Args: { p_booking_id: string; p_phase: string; p_rating: string; p_notes: string; p_checklist: string[] }; Returns: string }
      report_resource_incident: { Args: { p_resource_id: string; p_booking_id: string | null; p_severity: string; p_title: string; p_description: string }; Returns: string }
      update_resource_incident: { Args: { p_incident_id: string; p_status: string; p_note: string }; Returns: undefined }
      archive_resource: { Args: { p_resource_id: string }; Returns: undefined }
      restore_resource: { Args: { p_resource_id: string }; Returns: undefined }
      join_resource_waiting_list: { Args: { p_resource_id: string; p_starts_at: string; p_ends_at: string }; Returns: string }
      get_resource_booking_availability: {
        Args: { p_resource_id: string; p_starts_at: string; p_ends_at: string }
        Returns: {
          resource_available: boolean
          has_confirmed_conflict: boolean
          has_pending_conflict: boolean
          already_on_waiting_list: boolean
          can_join_waiting_list: boolean
        }[]
      }
      list_my_resource_waiting_list: {
        Args: Record<PropertyKey, never>
        Returns: {
          entry_id: string
          resource_id: string
          starts_at: string
          ends_at: string
          created_at: string
          queue_position: number
        }[]
      }
      cancel_resource_waiting_list: { Args: { p_entry_id: string }; Returns: undefined }
      list_pending_membership_applicants: { Args: { p_institution_id: string }; Returns: { membership_id: string; requested_at: string; applicant_name: string | null; applicant_email: string | null; requested_role: string | null; status: string }[] }
      list_institution_membership_directory: { Args: { p_institution_id: string }; Returns: { membership_id: string; applicant_name: string | null; applicant_email: string | null; requested_role: string | null; approved_roles: string[]; status: string; requested_at: string; reviewed_at: string | null }[] }
      review_institution_membership: { Args: { p_membership_id: string; p_status: string; p_roles: string[] }; Returns: undefined }
      update_institution_name: { Args: { p_institution_id: string; p_name: string }; Returns: { id: string; name: string; slug: string; is_active: boolean; created_at: string; updated_at: string } }
      upsert_notification_push_subscription: { Args: { p_endpoint: string; p_p256dh: string; p_auth: string }; Returns: string }
      delete_notification_push_subscription: { Args: { p_endpoint: string }; Returns: boolean }
      claim_notification_delivery_jobs: {
        Args: { p_channels: string[]; p_limit: number }
        Returns: { id: string; notification_id: string; recipient_id: string; channel: string; title: string; body: string }[]
      }
      finish_notification_delivery_job: {
        Args: { p_id: string; p_outcome: string; p_error_code?: string | null; p_provider_message_id?: string | null }
        Returns: boolean
      }
      queue_scheduled_booking_notifications: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
