import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { resolveTopicAccess } from '@/lib/classrooms/access'
import { isStyleTutorialsEnabled } from '@/lib/tutorials/featureFlag'
import { loadOrGenerateTutorial } from '@/lib/tutorials/loadOrGenerateTutorial'

function preferNonEmptyString(value, fallback) {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

async function searchWikimediaImage(query) {
  try {
    const searchUrl = new URL('https://commons.wikimedia.org/w/api.php')
    searchUrl.searchParams.set('action', 'query')
    searchUrl.searchParams.set('generator', 'search')
    searchUrl.searchParams.set('gsrsearch', `${query} filetype:bitmap`)
    searchUrl.searchParams.set('gsrnamespace', '6')
    searchUrl.searchParams.set('gsrlimit', '5')
    searchUrl.searchParams.set('prop', 'imageinfo')
    searchUrl.searchParams.set('iiprop', 'url|extmetadata')
    searchUrl.searchParams.set('iiurlwidth', '800')
    searchUrl.searchParams.set('format', 'json')
    searchUrl.searchParams.set('origin', '*')

    const response = await fetch(searchUrl.toString(), {
      headers: { 'User-Agent': 'Learnify/1.0 (Educational Platform)' }
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const pages = data.query?.pages

    if (!pages) {
      return null
    }

    const pageArray = Object.values(pages).filter((page) => {
      const url = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url
      return url && !url.endsWith('.svg')
    })

    if (pageArray.length === 0) {
      return null
    }

    const bestPage = pageArray[0]
    const imageInfo = bestPage.imageinfo?.[0]
    return imageInfo?.thumburl || imageInfo?.url || null
  } catch (error) {
    console.error(`[Wikimedia] Error searching for "${query}":`, error.message)
    return null
  }
}

async function validateImageUrl(url) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Learnify/1.0' }
    })

    clearTimeout(timeoutId)
    return response.ok
  } catch (error) {
    return false
  }
}

async function processTutorialMarkdown(markdown) {
  let finalContent = String(markdown || '')
    .replace(/^```markdown\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .trim()

  const embeddedImagePlaceholderRegex = /!\[([^\]]*)\]\(<<IMAGE:\s*([^>]+)>>\)/g
  const embeddedMatches = [...finalContent.matchAll(embeddedImagePlaceholderRegex)]

  for (const match of embeddedMatches) {
    const fullMatch = match[0]
    const altText = match[1].trim()
    const searchQuery = match[2].trim()
    const imageUrl = await searchWikimediaImage(searchQuery)

    if (imageUrl) {
      finalContent = finalContent.replace(fullMatch, `![${altText || searchQuery}](${imageUrl})`)
    } else {
      finalContent = finalContent.replace(fullMatch, '')
    }
  }

  const imagePlaceholderRegex = /<<IMAGE:\s*([^>]+)>>/g
  const placeholderMatches = [...finalContent.matchAll(imagePlaceholderRegex)]

  for (const match of placeholderMatches) {
    const fullPlaceholder = match[0]
    const searchQuery = match[1].trim()
    const imageUrl = await searchWikimediaImage(searchQuery)

    if (imageUrl) {
      finalContent = finalContent.replace(fullPlaceholder, `![${searchQuery}](${imageUrl})`)
    } else {
      finalContent = finalContent.replace(fullPlaceholder, '')
    }
  }

  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const existingImages = [...finalContent.matchAll(imgRegex)]

  for (const match of existingImages) {
    const fullTag = match[0]
    const url = match[2]

    if (url.includes('wikimedia.org') || url.startsWith('data:')) {
      continue
    }

    const isValid = await validateImageUrl(url)
    if (!isValid) {
      finalContent = finalContent.replace(fullTag, '')
    }
  }

  return finalContent
}

function mapTutorialRow(row, learningStyle) {
  if (!row) {
    return null
  }

  return {
    learningStyle,
    tutorialVersion: row.tutorial_version,
    tutorialMarkdown: row.tutorial_markdown,
    tutorialOutline: row.tutorial_outline,
    tutorialBlocks: Array.isArray(row.tutorial_blocks) ? row.tutorial_blocks : [],
    flashcards: Array.isArray(row.flashcards) ? row.flashcards : [],
    chatStarters: Array.isArray(row.chat_starters) ? row.chat_starters : [],
    reviewPrompts: Array.isArray(row.review_prompts) ? row.review_prompts : [],
    qualityReport: row.quality_report || null,
    generatedAt: row.updated_at
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      topicId,
      subjectTitle,
      topicTitle,
      topicDescription,
      difficulty,
      classroomId,
      classroomCourseId
    } = body

    if (!topicId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const topicAccess = await resolveTopicAccess(supabase, {
      userId: user.id,
      topicId,
      classroomId,
      classroomCourseId
    })

    if (topicAccess.mode === 'classroom' && !topicAccess.adminClient) {
      return NextResponse.json({
        error: 'Classroom content generation requires SUPABASE_SERVICE_ROLE_KEY on the server'
      }, { status: 500 })
    }

    const topic = {
      ...topicAccess.topic,
      title: preferNonEmptyString(topicTitle, topicAccess.topic?.title || 'Untitled Topic'),
      description: preferNonEmptyString(topicDescription, topicAccess.topic?.description || ''),
      difficulty: Number.isFinite(Number(difficulty)) ? Number(difficulty) : topicAccess.topic?.difficulty
    }
    const subject = {
      ...topicAccess.subject,
      title: preferNonEmptyString(subjectTitle, topicAccess.subject?.title || 'Untitled Subject')
    }

    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('gemini_api_key')
      .eq('id', user.id)
      .maybeSingle()

    if (userError) {
      console.error('Error fetching user API key:', userError)
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('education_level, learning_goals, preferred_learning_style, occupation')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching tutorial profile:', profileError)
    }

    if (!isStyleTutorialsEnabled()) {
      const fallbackContent = String(topic.content || topic.description || '').trim()
      return NextResponse.json({
        success: true,
        content: fallbackContent,
        tutorial: null,
        flashcards: Array.isArray(topic.flashcards) ? topic.flashcards : [],
        chatStarters: [],
        reviewPrompts: []
      })
    }

    const { tutorial, learningStyle, source } = await loadOrGenerateTutorial({
      supabase,
      topic,
      subject,
      user,
      userProfile: userProfile || {},
      apiKey: userData?.gemini_api_key,
      processMarkdown: processTutorialMarkdown
    })

    const genericContent = String(topic.content || '').trim()
    if (topicAccess.mode === 'owner' && genericContent.length < 120 && tutorial?.tutorial_markdown) {
      const writer = topicAccess.adminClient || supabase
      const { error: updateError } = await writer
        .from('topics')
        .update({ content: tutorial.tutorial_markdown })
        .eq('id', topicId)

      if (updateError) {
        console.error('Error updating fallback topic content:', updateError)
      }
    }

    const tutorialPayload = mapTutorialRow(tutorial, learningStyle)

    return NextResponse.json({
      success: true,
      content: tutorialPayload?.tutorialMarkdown || '',
      tutorial: tutorialPayload,
      flashcards: tutorialPayload?.flashcards || [],
      chatStarters: tutorialPayload?.chatStarters || [],
      reviewPrompts: tutorialPayload?.reviewPrompts || [],
      learningStyle,
      source
    })
  } catch (error) {
    console.error('Error generating topic content:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}
