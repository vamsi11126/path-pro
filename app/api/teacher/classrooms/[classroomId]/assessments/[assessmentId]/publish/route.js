import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTeacher } from '@/lib/classrooms/auth'
import { publishTeacherAssessment } from '@/lib/classrooms/assessments'

export async function POST(_request, { params }) {
  try {
    const supabase = await createClient()
    const { user } = await requireTeacher(supabase)
    const result = await publishTeacherAssessment(
      supabase,
      params.classroomId,
      params.assessmentId,
      user.id
    )

    return NextResponse.json(result)
  } catch (error) {
    const status = error.message === 'Teacher access required' || error.message === 'Unauthorized'
      ? 403
      : 400

    return NextResponse.json({ error: error.message }, { status })
  }
}
