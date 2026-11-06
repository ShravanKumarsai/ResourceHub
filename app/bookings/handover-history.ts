'use server'

import { requireWorkspaceRole } from '@/lib/auth/workspace'
import type { Database } from '@/lib/supabase/database.types'

const PAGE_SIZE = 25
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
type ConditionReportRow = Database['public']['Tables']['condition_reports']['Row']

export type HandoverHistoryFilters = {
  resourceId: string
  institutionId: string
  studentUserId: string
  bookingId: string
  fromDate: string
  toDate: string
  returnStatus: 'all' | 'on_time' | 'late'
  completion: 'all' | 'completed' | 'outstanding'
  sort: 'newest' | 'oldest' | 'latest_return'
  page: number
}

export type HandoverCondition = {
  rating: string
  notes: string
  checklist: string[]
  recordedAt: string
  evidence: Array<{ path: string; url: string }>
}

export type ManagerHandover = {
  id: string
  bookingId: string
  resourceId: string
  resourceName: string
  institutionId: string
  institutionName: string
  studentUserId: string
  studentName: string
  studentEmail: string | null
  scheduledStart: string
  scheduledEnd: string
  checkedOutAt: string
  checkedInAt: string | null
  deadline: string
  timezone: string
  returnedOnTime: boolean | null
  studentComments: string
  checkOut: HandoverCondition | null
  checkIn: HandoverCondition | null
  lateFlagAt: string | null
  lateFlagCount: number
  lateFlagThreshold: number
}

function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function dateToIso(value: string) {
  if (!value) return null
  if (!isValidDate(value)) throw new Error('Choose a valid date range.')
  return `${value}T00:00:00.000Z`
}

export async function loadManagedHandoverHistory(
  filters: HandoverHistoryFilters,
): Promise<{
  resources: Array<{ id: string; name: string; institutionId: string; institutionName: string }>
  handovers: ManagerHandover[]
  page: number
  pageSize: number
  total: number
}> {
  if (
    !filters ||
    !Number.isSafeInteger(filters.page) ||
    filters.page < 0 ||
    filters.page > 10000 ||
    !['all', 'on_time', 'late'].includes(filters.returnStatus) ||
    !['all', 'completed', 'outstanding'].includes(filters.completion) ||
    !['newest', 'oldest', 'latest_return'].includes(filters.sort) ||
    (filters.resourceId && !UUID_PATTERN.test(filters.resourceId)) ||
    (filters.institutionId && !UUID_PATTERN.test(filters.institutionId)) ||
    (filters.studentUserId && !UUID_PATTERN.test(filters.studentUserId)) ||
    (filters.bookingId && !UUID_PATTERN.test(filters.bookingId))
  ) {
    throw new Error('Handover history filters are invalid.')
  }
  const fromDate = dateToIso(filters.fromDate)
  const toDate = dateToIso(filters.toDate)
  if (fromDate && toDate && fromDate > toDate) {
    throw new Error('The start date must be on or before the end date.')
  }

  const { supabase, user } = await requireWorkspaceRole('resource_manager')
  const resourcesResult = await supabase
    .from('resources')
    .select('id, name, institution_id')
    .eq('owner_user_id', user.id)
    .order('name', { ascending: true })
  if (resourcesResult.error) throw resourcesResult.error

  const ownedResources = resourcesResult.data ?? []
  const institutionsResult = ownedResources.length
    ? await supabase
        .from('institutions')
        .select('id, name')
        .in('id', [...new Set(ownedResources.map((resource) => resource.institution_id))])
    : { data: [], error: null }
  if (institutionsResult.error) throw institutionsResult.error

  const institutionNames = new Map(
    (institutionsResult.data ?? []).map((institution) => [institution.id, institution.name]),
  )
  const resources = ownedResources.map((resource) => ({
    id: resource.id,
    name: resource.name,
    institutionId: resource.institution_id,
    institutionName: institutionNames.get(resource.institution_id) ?? 'Institution',
  }))

  const resourceIds = ownedResources
    .filter((resource) => !filters.institutionId || resource.institution_id === filters.institutionId)
    .filter((resource) => !filters.resourceId || resource.id === filters.resourceId)
    .map((resource) => resource.id)
  if (!resourceIds.length) {
    return { resources, handovers: [], page: filters.page, pageSize: PAGE_SIZE, total: 0 }
  }

  let query = supabase
    .from('handover_records')
    .select(
      'id, booking_id, institution_id, resource_id, student_user_id, checked_out_at, checked_in_at, check_in_deadline, timezone, returned_on_time, student_comments',
      { count: 'exact' },
    )
    .in('resource_id', resourceIds)

  if (filters.studentUserId) query = query.eq('student_user_id', filters.studentUserId)
  if (filters.bookingId) query = query.eq('booking_id', filters.bookingId)
  if (fromDate) query = query.gte('checked_out_at', fromDate)
  if (toDate) {
    const exclusiveEnd = new Date(new Date(toDate).getTime() + 24 * 60 * 60 * 1000).toISOString()
    query = query.lt('checked_out_at', exclusiveEnd)
  }
  if (filters.returnStatus === 'on_time') query = query.eq('returned_on_time', true)
  if (filters.returnStatus === 'late') query = query.eq('returned_on_time', false)
  if (filters.completion === 'completed') query = query.not('checked_in_at', 'is', null)
  if (filters.completion === 'outstanding') query = query.is('checked_in_at', null)

  if (filters.sort === 'latest_return') {
    query = query
      .order('checked_in_at', { ascending: false, nullsFirst: false })
      .order('checked_out_at', { ascending: false })
  } else {
    query = query
      .order('checked_out_at', { ascending: filters.sort === 'oldest' })
      .order('id', { ascending: filters.sort === 'oldest' })
  }

  const { data: handoverRows, count, error: handoverError } = await query.range(
    filters.page * PAGE_SIZE,
    (filters.page + 1) * PAGE_SIZE - 1,
  )
  if (handoverError) throw handoverError

  const rows = handoverRows ?? []
  const bookingIds = [...new Set(rows.map((row) => row.booking_id))]
  const studentIds = [...new Set(rows.map((row) => row.student_user_id))]
  if (!bookingIds.length) {
    return { resources, handovers: [], page: filters.page, pageSize: PAGE_SIZE, total: count ?? 0 }
  }

  const [bookingsResult, reportsResult, flagsResult, requesterResult, countsResult] =
    await Promise.all([
      supabase
        .from('bookings')
        .select('id, starts_at, ends_at')
        .in('id', bookingIds),
      supabase
        .from('condition_reports')
        .select('id, booking_id, phase, rating, notes, checklist, recorded_by, recorded_at, evidence_paths')
        .in('booking_id', bookingIds),
      supabase
        .from('late_return_flags')
        .select('booking_id, flagged_at')
        .in('booking_id', bookingIds),
      supabase.rpc('list_owned_booking_requesters', {
        p_requester_user_ids: studentIds,
      }),
      supabase.rpc('get_owned_student_late_flag_counts', {
        p_student_user_ids: studentIds,
      }),
    ])

  if (bookingsResult.error) throw bookingsResult.error
  if (reportsResult.error) throw reportsResult.error
  if (flagsResult.error) throw flagsResult.error
  if (requesterResult.error) throw requesterResult.error
  if (countsResult.error) throw countsResult.error

  const bookingById = new Map((bookingsResult.data ?? []).map((booking) => [booking.id, booking]))
  const resourceById = new Map(ownedResources.map((resource) => [resource.id, resource]))
  const reportsByBooking = new Map<string, { check_out?: ConditionReportRow; check_in?: ConditionReportRow }>()
  for (const report of reportsResult.data ?? []) {
    const reports = reportsByBooking.get(report.booking_id) ?? {}
    if (report.phase === 'check_out') reports.check_out = report
    if (report.phase === 'check_in') reports.check_in = report
    reportsByBooking.set(report.booking_id, reports)
  }
  const requesterById = new Map(
    (requesterResult.data ?? []).map((requester) => [
      requester.requester_user_id,
      { name: requester.requester_name, email: requester.requester_email },
    ]),
  )
  const lateCounts = new Map(
    (countsResult.data ?? []).map((item) => [
      `${item.institution_id}:${item.student_user_id}`,
      { count: item.late_flag_count, threshold: item.late_flag_threshold },
    ]),
  )
  const flagByBooking = new Map(
    (flagsResult.data ?? []).map((flag) => [flag.booking_id, flag.flagged_at]),
  )
  const evidenceUrls = new Map<string, string>()
  const evidencePaths = [...new Set(
    (reportsResult.data ?? []).flatMap((report) => report.evidence_paths),
  )]
  const signedUrlResults = await Promise.all(
    evidencePaths.map((path) =>
      supabase.storage.from('handover-evidence').createSignedUrl(path, 60 * 60),
    ),
  )
  signedUrlResults.forEach(({ data, error }, index) => {
    if (error) throw error
    evidenceUrls.set(evidencePaths[index], data.signedUrl)
  })

  function mapCondition(report: ConditionReportRow | undefined): HandoverCondition | null {
    if (!report) return null
    return {
      rating: report.rating,
      notes: report.notes,
      checklist: report.checklist,
      recordedAt: report.recorded_at,
      evidence: report.evidence_paths.flatMap((path) => {
        const url = evidenceUrls.get(path)
        return url ? [{ path, url }] : []
      }),
    }
  }

  const handovers = rows.flatMap((row) => {
    const booking = bookingById.get(row.booking_id)
    const resource = resourceById.get(row.resource_id)
    if (!booking || !resource) return []
    const requester = requesterById.get(row.student_user_id)
    const countsForStudent = lateCounts.get(`${row.institution_id}:${row.student_user_id}`)
    const reports = reportsByBooking.get(row.booking_id) ?? {}
    return [{
      id: row.id,
      bookingId: row.booking_id,
      resourceId: row.resource_id,
      resourceName: resource.name,
      institutionId: row.institution_id,
      institutionName: institutionNames.get(row.institution_id) ?? 'Institution',
      studentUserId: row.student_user_id,
      studentName: requester?.name ?? 'Student',
      studentEmail: requester?.email ?? null,
      scheduledStart: booking.starts_at,
      scheduledEnd: booking.ends_at,
      checkedOutAt: row.checked_out_at,
      checkedInAt: row.checked_in_at,
      deadline: row.check_in_deadline,
      timezone: row.timezone,
      returnedOnTime: row.returned_on_time,
      studentComments: row.student_comments,
      checkOut: mapCondition(reports.check_out),
      checkIn: mapCondition(reports.check_in),
      lateFlagAt: flagByBooking.get(row.booking_id) ?? null,
      lateFlagCount: countsForStudent?.count ?? 0,
      lateFlagThreshold: countsForStudent?.threshold ?? 5,
    }]
  })

  return {
    resources,
    handovers,
    page: filters.page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
  }
}
