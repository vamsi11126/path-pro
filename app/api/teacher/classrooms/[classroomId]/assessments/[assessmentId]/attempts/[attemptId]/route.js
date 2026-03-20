import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTeacher } from '@/lib/classrooms/auth'
import {
  getTeacherAssessmentAttemptDetail,
  reviewTeacherAssessmentAttempt
} from '@/lib/classrooms/assessments'

export async function GET(_request, { params }) {
  try {
    const supabase = await createClient()
    const { user } = await requireTeacher(supabase)
    const detail = await getTeacherAssessmentAttemptDetail(
      supabase,
      params.classroomId,
      params.assessmentId,
      params.attemptId,
      user.id
    )

    return NextResponse.json(detail)
  } catch (error) {
    const status = error.message === 'Teacher access required' || error.message === 'Unauthorized'
      ? 403
      : 404

    return NextResponse.json({ error: error.message }, { status })
  }
}

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient()
    const { user } = await requireTeacher(supabase)
    const body = await request.json()
    const result = await reviewTeacherAssessmentAttempt(
      supabase,
      params.classroomId,
      params.assessmentId,
      params.attemptId,
      user.id,
      body
    )

    return NextResponse.json(result)
  } catch (error) {
    const status = error.message === 'Teacher access required' || error.message === 'Unauthorized'
      ? 403
      : 400

    return NextResponse.json({ error: error.message }, { status })
  }
}
