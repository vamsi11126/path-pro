import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTeacher } from '@/lib/classrooms/auth'
import {
  createTeacherAssessment,
  listTeacherClassroomAssessments
} from '@/lib/classrooms/assessments'

export async function GET(_request, { params }) {
  try {
    const supabase = await createClient()
    const { user } = await requireTeacher(supabase)
    const assessments = await listTeacherClassroomAssessments(supabase, params.classroomId, user.id)

    return NextResponse.json({ assessments })
  } catch (error) {
    const status = error.message === 'Teacher access required' || error.message === 'Unauthorized'
      ? 403
      : 400

    return NextResponse.json({ error: error.message }, { status })
  }
}

export async function POST(request, { params }) {
  try {
    const supabase = await createClient()
    const { user } = await requireTeacher(supabase)
    const body = await request.json()
    const result = await createTeacherAssessment(supabase, params.classroomId, user.id, body)

    return NextResponse.json(result)
  } catch (error) {
    const status = error.message === 'Teacher access required' || error.message === 'Unauthorized'
      ? 403
      : 400

    return NextResponse.json({ error: error.message }, { status })
  }
}
