import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateWithGemini } from '@/lib/gemini'
import { resolveTopicAccess } from '@/lib/classrooms/access'
import { isStyleTutorialsEnabled } from '@/lib/tutorials/featureFlag'
import { loadOrGenerateTutorial } from '@/lib/tutorials/loadOrGenerateTutorial'
import { normalizeLearningStyle } from '@/lib/learning-styles/constants'

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { topicId, message, history = [], classroomId = null, classroomCourseId = null } = body

    if (!topicId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const topicAccess = await resolveTopicAccess(supabase, {
      userId: user.id,
      topicId,
      classroomId,
      classroomCourseId
    })
    const topic = {
      ...topicAccess.topic,
      subjects: topicAccess.subject
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('education_level, learning_goals, preferred_learning_style, occupation, gemini_api_key')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching doubt chat profile:', profileError)
    }

    const learningStyle = normalizeLearningStyle(profile?.preferred_learning_style)
    const educationLevel = profile?.education_level || 'General Audience'

    let tutorialContext = ''
    let personalizedContent = String(topic.content || '')
    if (isStyleTutorialsEnabled()) {
      try {
        const { tutorial } = await loadOrGenerateTutorial({
          supabase,
          topic: topicAccess.topic,
          subject: topicAccess.subject,
          user,
          userProfile: profile || {},
          apiKey: profile?.gemini_api_key
        })

        tutorialContext = `
        TUTORIAL SESSION CONTEXT:
        - Tutorial Version: ${tutorial?.tutorial_version || 'v1'}
        - Tutorial Blocks: ${JSON.stringify(tutorial?.tutorial_blocks || []).slice(0, 5000)}
        - Review Prompts: ${JSON.stringify(tutorial?.review_prompts || []).slice(0, 1200)}
        - Chat Starters: ${JSON.stringify(tutorial?.chat_starters || []).slice(0, 1200)}
        `
        personalizedContent = String(tutorial?.tutorial_markdown || personalizedContent)
      } catch (error) {
        console.error('Failed to load personalized tutorial context for chat:', error)
      }
    }

    const systemPrompt = `You are an expert AI Tutor specialized in "${topic.subjects.title}".

    CURRENT CONTEXT:
    - Subject: ${topic.subjects.title}
    - Topic: ${topic.title}
    - Topic Description: ${topic.description}
    - Student Level: ${educationLevel}
    - Learning Style: ${learningStyle}
    - Learning Goal: ${profile?.learning_goals || 'Learn and retain the topic'}

    STYLE-SPECIFIC TUTORING BEHAVIOR:
    - Visual: refer back to patterns, diagrams, flows, and what to notice.
    - Auditory: answer conversationally and ask clarifying follow-up questions when useful.
    - Reading/Writing: be concise, structured, and note-friendly.
    - Kinesthetic: turn explanations into actions, mini-exercises, or applied steps.
    - Project-based: tie the explanation to deliverables, milestones, or build choices.

    INSTRUCTIONS:
    1. Answer the student's question specifically related to the provided topic content.
    2. If the question is strictly about the topic/subject, answer it helpfully and clearly.
    3. If the question is unrelated to the subject, politely refuse and ask to stay on topic.
    4. Use Markdown for formatting.
    5. Keep answers focused, but include a short follow-up prompt when it helps the learner.
    6. Reference the tutorial context when useful.

    TOPIC CONTENT CONTEXT:
    ${personalizedContent ? personalizedContent.slice(0, 12000) : 'No specific content generated yet.'}

    ${tutorialContext}`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message }
    ]

    const responseData = await generateWithGemini(messages, {
      apiKey: profile?.gemini_api_key
    })

    const content = responseData.choices[0].message.content

    return NextResponse.json({ content })
  } catch (error) {
    console.error('Doubt Chat Error:', error)
    const status = error.message === 'Unauthorized'
      ? 401
      : error.message === 'Topic is locked'
        ? 403
        : error.message.includes('not found')
          ? 404
          : 500

    return NextResponse.json({ error: 'Failed to process request', details: error.message }, { status })
  }
}
