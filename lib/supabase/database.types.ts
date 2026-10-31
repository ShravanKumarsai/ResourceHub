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
  created_at: string
  updated_at: string
}

type ResourceInsert = Omit<
  Resource,
  'id' | 'owner_name' | 'created_at' | 'updated_at'
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
      resources: Table<Resource, ResourceInsert, Partial<ResourceInsert>>
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
    }
    Views: Record<string, never>
    Functions: {
      request_resource_booking: { Args: { p_resource_id: string; p_starts_at: string; p_ends_at: string; p_purpose: string }; Returns: string }
      review_resource_booking: { Args: { p_booking_id: string; p_decision: string; p_note?: string | null }; Returns: undefined }
      cancel_resource_booking: { Args: { p_booking_id: string }; Returns: undefined }
      record_booking_condition_report: { Args: { p_booking_id: string; p_phase: string; p_rating: string; p_notes: string; p_checklist: string[] }; Returns: string }
      report_resource_incident: { Args: { p_resource_id: string; p_booking_id: string | null; p_severity: string; p_title: string; p_description: string }; Returns: string }
      update_resource_incident: { Args: { p_incident_id: string; p_status: string; p_note: string }; Returns: undefined }
      join_resource_waiting_list: { Args: { p_resource_id: string; p_starts_at: string; p_ends_at: string }; Returns: string }
      list_pending_membership_applicants: { Args: { p_institution_id: string }; Returns: { membership_id: string; requested_at: string; applicant_name: string | null; applicant_email: string | null; requested_role: string | null; status: string }[] }
      list_institution_membership_directory: { Args: { p_institution_id: string }; Returns: { membership_id: string; applicant_name: string | null; applicant_email: string | null; requested_role: string | null; approved_roles: string[]; status: string; requested_at: string; reviewed_at: string | null }[] }
      review_institution_membership: { Args: { p_membership_id: string; p_status: string; p_roles: string[] }; Returns: undefined }
      update_institution_name: { Args: { p_institution_id: string; p_name: string }; Returns: { id: string; name: string; slug: string; is_active: boolean; created_at: string; updated_at: string } }
      consume_rate_limit: { Args: { p_scope: string; p_limit: number; p_window_seconds: number }; Returns: boolean }
      update_institution_reservation_limit: { Args: { p_institution_id: string; p_limit: number }; Returns: undefined }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
