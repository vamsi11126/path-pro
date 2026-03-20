import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTeacher } from '@/lib/classrooms/auth'
import { updateTeacherClassroomWeeklyAward } from '@/lib/classrooms/rewards'

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient()
    const { user } = await requireTeacher(supabase)
    const body = await request.json()

    const { data: classroom, error: classroomError } = await supabase
      .from('classrooms')
      .select('id, timezone')
      .eq('id', params.classroomId)
      .eq('teacher_user_id', user.id)
      .maybeSingle()

    if (classroomError) {
      throw new Error(classroomError.message)
    }

    if (!classroom) {
      throw new Error('Classroom not found')
    }

    const award = await updateTeacherClassroomWeeklyAward(supabase, {
      classroomId: params.classroomId,
      teacherUserId: user.id,
      weekStartKey: decodeURIComponent(params.weekStart),
      classroomTimeZone: classroom.timezone,
      rewardTitle: typeof body.rewardTitle === 'string' ? body.rewardTitle.trim() : '',
      teacherNote: typeof body.teacherNote === 'string' ? body.teacherNote.trim() : ''
    })

    return NextResponse.json({ award })
  } catch (error) {
    const status = error.message === 'Teacher access required' || error.message === 'Unauthorized'
      ? 403
      : error.message === 'Classroom not found' || error.message === 'Weekly award not found'
        ? 404
        : 400

    return NextResponse.json({ error: error.message }, { status })
  }
}
