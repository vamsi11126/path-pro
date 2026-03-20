import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/classrooms/auth'
import { listStudentClassroomAssessments } from '@/lib/classrooms/assessments'

export async function GET(_request, { params }) {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser(supabase)
    const assessments = await listStudentClassroomAssessments(supabase, params.classroomId, user.id)

    return NextResponse.json({ assessments })
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : 400
    return NextResponse.json({ error: error.message }, { status })
  }
}
