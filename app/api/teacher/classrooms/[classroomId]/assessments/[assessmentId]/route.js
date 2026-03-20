import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTeacher } from '@/lib/classrooms/auth'
import {
  addTeacherAssessmentQuestion,
  getTeacherAssessmentDetail,
  updateTeacherAssessment
} from '@/lib/classrooms/assessments'

export async function GET(_request, { params }) {
  try {
    const supabase = await createClient()
    const { user } = await requireTeacher(supabase)
    const detail = await getTeacherAssessmentDetail(
      supabase,
      params.classroomId,
      params.assessmentId,
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

    let result
    if (body.action === 'add-question') {
      result = await addTeacherAssessmentQuestion(
        supabase,
        params.classroomId,
        params.assessmentId,
        user.id,
        body.question || {}
      )
    } else {
      result = await updateTeacherAssessment(
        supabase,
        params.classroomId,
        params.assessmentId,
        user.id,
        body
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    const status = error.message === 'Teacher access required' || error.message === 'Unauthorized'
      ? 403
      : 400

    return NextResponse.json({ error: error.message }, { status })
  }
}
