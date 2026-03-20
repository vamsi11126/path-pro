import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/classrooms/auth'
import { listStudentActiveClassroomRewards } from '@/lib/classrooms/rewards'

export async function GET() {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser(supabase)
    const rewards = await listStudentActiveClassroomRewards(supabase, {
      studentUserId: user.id
    })

    return NextResponse.json({ rewards })
  } catch (error) {
    const status = error.message === 'Unauthorized' ? 401 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
