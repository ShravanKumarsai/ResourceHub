import { createClient } from '@/lib/supabase/server'
import { getSupabaseConfig } from '@/lib/supabase/config'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function response(status: number, result: Record<string, string>) {
  return NextResponse.json(result, { status })
}

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 })
  }

  try {
    getSupabaseConfig()
  } catch {
    return response(500, {
      status: 'environment_error',
      message:
        'Supabase environment configuration is missing. Check .env.local variable names and restart the development server.',
    })
  }

  const table = process.env.SUPABASE_CONNECTION_TEST_TABLE?.trim() ||
    'resourcehub_connection_test'

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    return response(500, {
      status: 'environment_error',
      message:
        'SUPABASE_CONNECTION_TEST_TABLE must be a single table name using letters, numbers, and underscores.',
    })
  }

  try {
    const supabase = await createClient()
    const { error, status } = await supabase
      .from(table)
      .select('*', { head: true })
      .limit(0)

    if (!error) {
      return response(200, {
        status: 'success',
        message: `Supabase responded successfully; the "${table}" table is accessible to this request.`,
      })
    }

    if (
      error.code === 'PGRST205' ||
      error.code === '42P01' ||
      status === 404
    ) {
      return response(404, {
        status: 'missing_table',
        message: `Supabase responded, but the "${table}" table was not found. This does not indicate a broken connection.`,
      })
    }

    if (status === 401 || error.code === 'PGRST301') {
      return response(401, {
        status: 'authentication_error',
        message:
          'Supabase rejected the request credentials. Check that the project URL and publishable key belong to the same project.',
      })
    }

    if (status === 403 || error.code === '42501') {
      return response(403, {
        status: 'permission_error',
        message:
          'Supabase received the request but denied table access. Check the table grants and Row Level Security policy for this role.',
      })
    }

    return response(502, {
      status: 'supabase_error',
      message: `Supabase returned an error while checking the "${table}" table (code: ${error.code || 'unknown'}).`,
    })
  } catch {
    return response(502, {
      status: 'connection_error',
      message:
        'The Supabase request could not be completed. Check network access and the configured project URL.',
    })
  }
}
