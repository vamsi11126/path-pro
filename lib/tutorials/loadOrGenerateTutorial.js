import { TUTORIAL_VERSION, normalizeLearningStyle, STYLE_RECIPE_VERSION } from '@/lib/learning-styles/constants'
import { buildSourceSignature } from '@/lib/tutorials/buildSourceSignature'
import { getTutorialVariant } from '@/lib/tutorials/getTutorialVariant'
import { saveTutorialVariant } from '@/lib/tutorials/saveTutorialVariant'
import { generateTutorialOutline } from '@/lib/tutorials/generateOutline'
import { generateTutorialBundle } from '@/lib/tutorials/generateTutorial'
import { repairTutorialBundle } from '@/lib/tutorials/repairTutorial'
import { validateTutorialBundle } from '@/lib/tutorials/validators'
import { buildFallbackTutorialBundle } from '@/lib/tutorials/buildFallbackTutorialBundle'

const MAX_REPAIR_ATTEMPTS = 2

async function processBundleMarkdownFields(value, processMarkdown, key = '') {
  if (typeof processMarkdown !== 'function') {
    return value
  }

  if (typeof value === 'string') {
    if (key === 'tutorialMarkdown' || key === 'markdown') {
      return processMarkdown(value)
    }
    return value
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((entry) => processBundleMarkdownFields(entry, processMarkdown, key)))
  }

  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value).map(async ([entryKey, entryValue]) => ([
        entryKey,
        await processBundleMarkdownFields(entryValue, processMarkdown, entryKey)
      ]))
    )

    return Object.fromEntries(entries)
  }

  return value
}

function buildQualityReport({ passed, repaired, errors, sourceSignature }) {
  return {
    passed,
    repaired,
    errors,
    tutorialVersion: TUTORIAL_VERSION,
    styleRecipeVersion: STYLE_RECIPE_VERSION,
    sourceSignature,
    generatedAt: new Date().toISOString()
  }
}

function normalizeStoredTutorialForValidation(row) {
  if (!row) {
    return null
  }

  return {
    tutorialMarkdown: row.tutorial_markdown || row.tutorialMarkdown || '',
    tutorialBlocks: Array.isArray(row.tutorial_blocks)
      ? row.tutorial_blocks
      : Array.isArray(row.tutorialBlocks)
        ? row.tutorialBlocks
        : [],
    flashcards: Array.isArray(row.flashcards) ? row.flashcards : [],
    chatStarters: Array.isArray(row.chat_starters)
      ? row.chat_starters
      : Array.isArray(row.chatStarters)
        ? row.chatStarters
        : [],
    reviewPrompts: Array.isArray(row.review_prompts)
      ? row.review_prompts
      : Array.isArray(row.reviewPrompts)
        ? row.reviewPrompts
        : []
  }
}

export async function loadOrGenerateTutorial({
  supabase,
  topic,
  subject,
  user,
  userProfile,
  apiKey,
  processMarkdown
}) {
  const learningStyle = normalizeLearningStyle(userProfile?.preferred_learning_style)
  const sourceSignature = buildSourceSignature({
    learningStyle,
    topicTitle: topic?.title || '',
    topicDescription: topic?.description || '',
    topicDifficulty: topic?.difficulty || 3,
    subjectTitle: subject?.title || '',
    subjectDescription: subject?.description || '',
    subjectSyllabus: subject?.syllabus || '',
    educationLevel: userProfile?.education_level || '',
    occupation: userProfile?.occupation || '',
    learningGoals: userProfile?.learning_goals || '',
    tutorialVersion: TUTORIAL_VERSION,
    styleRecipeVersion: STYLE_RECIPE_VERSION
  })

  const existing = await getTutorialVariant(supabase, {
    topicId: topic.id,
    userId: user.id,
    learningStyle,
    tutorialVersion: TUTORIAL_VERSION
  })

  const tutorialContext = {
    subjectTitle: subject?.title || '',
    subjectDescription: subject?.description || '',
    subjectSyllabus: subject?.syllabus || '',
    topicTitle: topic?.title || '',
    topicDescription: topic?.description || ''
  }

  if (existing && existing.source_signature === sourceSignature) {
    const cachedValidation = validateTutorialBundle(
      normalizeStoredTutorialForValidation(existing),
      learningStyle,
      tutorialContext
    )

    if (cachedValidation.isValid) {
      return {
        tutorial: existing,
        learningStyle,
        source: 'cache'
      }
    }
  }

  let outline = null
  let bundle = null
  let repaired = false
  let validation = { isValid: false, errors: [] }

  try {
    outline = await generateTutorialOutline({
      apiKey,
      subjectTitle: subject?.title || 'Untitled Subject',
      subjectDescription: subject?.description || '',
      subjectSyllabus: subject?.syllabus || '',
      topicTitle: topic?.title || 'Untitled Topic',
      topicDescription: topic?.description || '',
      difficulty: topic?.difficulty || 3,
      userProfile,
      learningStyle
    })

    bundle = await generateTutorialBundle({
      apiKey,
      subjectTitle: subject?.title || 'Untitled Subject',
      subjectDescription: subject?.description || '',
      subjectSyllabus: subject?.syllabus || '',
      topicTitle: topic?.title || 'Untitled Topic',
      topicDescription: topic?.description || '',
      difficulty: topic?.difficulty || 3,
      userProfile,
      learningStyle,
      outline
    })

    bundle = await processBundleMarkdownFields(bundle, processMarkdown)

    validation = validateTutorialBundle(bundle, learningStyle, tutorialContext)

    let repairAttempts = 0
    while (!validation.isValid && repairAttempts < MAX_REPAIR_ATTEMPTS) {
      repaired = true
      bundle = await repairTutorialBundle({
        apiKey,
        learningStyle,
        subjectTitle: subject?.title || '',
        subjectDescription: subject?.description || '',
        subjectSyllabus: subject?.syllabus || '',
        topicTitle: topic?.title || 'Untitled Topic',
        topicDescription: topic?.description || '',
        userProfile,
        errors: validation.errors,
        outline,
        brokenPayload: bundle
      })

      bundle = await processBundleMarkdownFields(bundle, processMarkdown)
      validation = validateTutorialBundle(bundle, learningStyle, tutorialContext)
      repairAttempts += 1
    }
  } catch (error) {
    validation = {
      isValid: false,
      errors: [error.message]
    }
  }

  if (!validation.isValid || !bundle) {
    bundle = buildFallbackTutorialBundle({
      learningStyle,
      topicTitle: topic?.title || 'Untitled Topic',
      topicDescription: topic?.description || '',
      subjectTitle: subject?.title || ''
    })
    bundle = await processBundleMarkdownFields(bundle, processMarkdown)
    validation = validateTutorialBundle(bundle, learningStyle, tutorialContext)
  }

  const qualityReport = buildQualityReport({
    passed: validation.isValid,
    repaired,
    errors: validation.errors,
    sourceSignature
  })

  const saved = await saveTutorialVariant(supabase, {
    topicId: topic.id,
    userId: user.id,
    learningStyle,
    tutorialVersion: TUTORIAL_VERSION,
    tutorialMarkdown: bundle.tutorialMarkdown,
    tutorialOutline: outline || [],
    tutorialBlocks: bundle.tutorialBlocks,
    flashcards: bundle.flashcards,
    chatStarters: bundle.chatStarters,
    reviewPrompts: bundle.reviewPrompts,
    qualityReport,
    sourceSignature
  })

  return {
    tutorial: saved,
    learningStyle,
    source: 'generated'
  }
}
