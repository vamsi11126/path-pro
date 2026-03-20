import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/classrooms/auth'
import {
  getStudentAssessmentSession,
  startStudentAssessmentAttempt
} from '@/lib/classrooms/assessments'

export async function GET(_request, { params }) {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser(supabase)
    const session = await getStudentAssessmentSession(
      supabase,
      params.classroomId,
      params.assessmentId,
      user.id
    )

    return NextResponse.json(session)
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : 400
    return NextResponse.json({ error: error.message }, { status })
  }
}

export async function POST(_request, { params }) {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser(supabase)
    const attempt = await startStudentAssessmentAttempt(
      supabase,
      params.classroomId,
      params.assessmentId,
      user.id
    )

    return NextResponse.json({ attempt })
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : 400
    return NextResponse.json({ error: error.message }, { status })
  }
}
