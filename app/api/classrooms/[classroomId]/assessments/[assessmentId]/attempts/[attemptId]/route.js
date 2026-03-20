import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/classrooms/auth'
import {
  saveStudentAssessmentAnswer,
  submitStudentAssessmentAttempt
} from '@/lib/classrooms/assessments'

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser(supabase)
    const body = await request.json()
    const result = await saveStudentAssessmentAnswer(
      supabase,
      params.classroomId,
      params.assessmentId,
      params.attemptId,
      user.id,
      body
    )

    return NextResponse.json(result)
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : 400
    return NextResponse.json({ error: error.message }, { status })
  }
}

export async function POST(_request, { params }) {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser(supabase)
    const result = await submitStudentAssessmentAttempt(
      supabase,
      params.classroomId,
      params.assessmentId,
      params.attemptId,
      user.id
    )

    return NextResponse.json(result)
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : 400
    return NextResponse.json({ error: error.message }, { status })
  }
}
