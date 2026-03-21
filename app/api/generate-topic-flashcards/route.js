import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveTopicAccess } from '@/lib/classrooms/access'
import { isStyleTutorialsEnabled } from '@/lib/tutorials/featureFlag'
import { loadOrGenerateTutorial } from '@/lib/tutorials/loadOrGenerateTutorial'

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { topicId, classroomId, classroomCourseId } = body

    if (!topicId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const topicAccess = await resolveTopicAccess(supabase, {
      userId: user.id,
      topicId,
      classroomId,
      classroomCourseId
    })

    if (!isStyleTutorialsEnabled()) {
      if (topicAccess.topic?.flashcards && Array.isArray(topicAccess.topic.flashcards) && topicAccess.topic.flashcards.length > 0) {
        return NextResponse.json({
          success: true,
          flashcards: topicAccess.topic.flashcards
        })
      }

      return NextResponse.json({
        success: true,
        flashcards: []
      })
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('education_level, learning_goals, preferred_learning_style, occupation, gemini_api_key')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile for flashcards:', profileError)
    }

    const { tutorial } = await loadOrGenerateTutorial({
      supabase,
      topic: topicAccess.topic,
      subject: topicAccess.subject,
      user,
      userProfile: userProfile || {},
      apiKey: userProfile?.gemini_api_key
    })

    const flashcards = Array.isArray(tutorial?.flashcards) ? tutorial.flashcards : []

    if (flashcards.length > 0) {
      return NextResponse.json({
        success: true,
        flashcards
      })
    }

    return NextResponse.json({
      success: true,
      flashcards: Array.isArray(topicAccess.topic?.flashcards) ? topicAccess.topic.flashcards : []
    })
  } catch (error) {
    console.error('Error generating flashcards:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}
